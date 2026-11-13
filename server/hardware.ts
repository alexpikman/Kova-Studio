import { execFile } from 'child_process';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
import { ensureKovaDirs } from './paths';

const execFileAsync = promisify(execFile);

export interface HardwareGpuInfo {
  vendor: 'nvidia' | 'amd' | 'apple' | 'intel' | 'unknown';
  name: string;
  vramTotalGb: number;
  vramFreeGb: number;
  driverOrRuntime: string;
}

export interface HardwareProfile {
  detectedAt: string;
  os: {
    platform: string;
    release: string;
    arch: string;
    hostname: string;
  };
  cpu: {
    model: string;
    cores: number;
  };
  ram: {
    totalBytes: number;
    freeBytes: number;
    totalGb: number;
    freeGb: number;
  };
  disk: {
    path: string;
    totalBytes: number;
    freeBytes: number;
    totalGb: number;
    freeGb: number;
  };
  gpuDetected: boolean;
  gpus: HardwareGpuInfo[];
  totalVramGb: number;
  freeVramGb: number;
  recommendedBackend: 'cuda' | 'rocm' | 'metal' | 'cpu';
  backendVersion: string;
  notes: string[];
}

export type ModelFitCategory = 'fits-vram' | 'fits-ram' | 'too-heavy';

export interface ModelRecommendationInput {
  id: string;
  name: string;
  quant: string;
  sizeGb: number;
  minVramGb?: number;
  minRamGb?: number;
}

export interface ModelRecommendation {
  id: string;
  category: ModelFitCategory;
  categoryLabel: 'Поместится в VRAM' | 'Поместится в RAM (CPU)' | 'Слишком тяжело';
  requiredVramGb: number;
  requiredRamGb: number;
  remainingVramAfterGb: number;
  remainingRamAfterGb: number;
  diskFits: boolean;
  reason: string;
  warning?: string;
  allowManualOverride: boolean;
}

function bytesToGb(bytes: number): number {
  return Number((bytes / (1024 * 1024 * 1024)).toFixed(2));
}

function detectDiskSpace(targetDir: string): { totalBytes: number; freeBytes: number } {
  try {
    const stat = fs.statfsSync(targetDir);
    const totalBytes = Number(stat.blocks) * Number(stat.bsize);
    const freeBytes = Number(stat.bavail) * Number(stat.bsize);
    if (Number.isFinite(totalBytes) && Number.isFinite(freeBytes)) {
      return { totalBytes, freeBytes };
    }
  } catch {
    // fallback handled below
  }
  return { totalBytes: 0, freeBytes: 0 };
}

async function probeNvidiaGpus(): Promise<{ gpus: HardwareGpuInfo[]; cudaVersion: string | null }> {
  try {
    const { stdout } = await execFileAsync(
      'nvidia-smi',
      ['--query-gpu=name,memory.total,memory.free,driver_version', '--format=csv,noheader,nounits'],
      { timeout: 3500 },
    );
    const lines = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return { gpus: [], cudaVersion: null };

    let cudaVersion: string | null = null;
    try {
      const nvcc = await execFileAsync('nvcc', ['--version'], { timeout: 2500 });
      const m = nvcc.stdout.match(/release\s+([\d.]+)/i);
      if (m) cudaVersion = `CUDA ${m[1]}`;
    } catch {
      try {
        const smiHeader = await execFileAsync('nvidia-smi', [], { timeout: 2500 });
        const m = smiHeader.stdout.match(/CUDA Version:\s*([\d.]+)/i);
        if (m) cudaVersion = `CUDA ${m[1]}`;
      } catch {
        // ignore
      }
    }

    const gpus: HardwareGpuInfo[] = lines.map((line) => {
      const [nameRaw, totalMbRaw, freeMbRaw, driverRaw] = line.split(',').map((s) => s.trim());
      const totalGb = Number(((Number(totalMbRaw) || 0) / 1024).toFixed(2));
      const freeGb = Number(((Number(freeMbRaw) || 0) / 1024).toFixed(2));
      return {
        vendor: 'nvidia',
        name: nameRaw || 'NVIDIA GPU',
        vramTotalGb: totalGb,
        vramFreeGb: freeGb,
        driverOrRuntime: cudaVersion ? `${cudaVersion} (Driver ${driverRaw || 'N/A'})` : `NVIDIA Driver ${driverRaw || 'N/A'}`,
      };
    });

    return { gpus, cudaVersion };
  } catch {
    return { gpus: [], cudaVersion: null };
  }
}

async function probeAmdGpus(): Promise<{ gpus: HardwareGpuInfo[]; rocmVersion: string | null }> {
  // Check rocm-smi first
  try {
    const { stdout } = await execFileAsync('rocm-smi', ['--showproductname', '--showmeminfo', 'vram', '--json'], {
      timeout: 3500,
    });
    const parsed = JSON.parse(stdout) as Record<string, Record<string, string>>;
    const gpus: HardwareGpuInfo[] = [];
    for (const [cardKey, info] of Object.entries(parsed)) {
      if (!cardKey.startsWith('card')) continue;
      const totalBytes = Number(info['VRAM Total Memory (B)'] || 0);
      const usedBytes = Number(info['VRAM Total Used Memory (B)'] || 0);
      if (totalBytes > 0) {
        gpus.push({
          vendor: 'amd',
          name: info['Card series'] || info['Card model'] || `AMD GPU (${cardKey})`,
          vramTotalGb: bytesToGb(totalBytes),
          vramFreeGb: bytesToGb(Math.max(0, totalBytes - usedBytes)),
          driverOrRuntime: 'ROCm',
        });
      }
    }
    if (gpus.length > 0) {
      return { gpus, rocmVersion: 'ROCm' };
    }
  } catch {
    // ignore
  }

  // Linux sysfs AMD DRM fallback
  if (os.platform() === 'linux') {
    try {
      const drmDir = '/sys/class/drm';
      if (fs.existsSync(drmDir)) {
        const cards = fs.readdirSync(drmDir).filter((d) => /^card\d+$/.test(d));
        const gpus: HardwareGpuInfo[] = [];
        for (const card of cards) {
          const vramTotalPath = `${drmDir}/${card}/device/mem_info_vram_total`;
          const vramUsedPath = `${drmDir}/${card}/device/mem_info_vram_used`;
          if (fs.existsSync(vramTotalPath)) {
            const total = Number(fs.readFileSync(vramTotalPath, 'utf-8').trim()) || 0;
            const used = fs.existsSync(vramUsedPath)
              ? Number(fs.readFileSync(vramUsedPath, 'utf-8').trim()) || 0
              : 0;
            if (total > 0) {
              gpus.push({
                vendor: 'amd',
                name: `AMD Radeon (${card})`,
                vramTotalGb: bytesToGb(total),
                vramFreeGb: bytesToGb(Math.max(0, total - used)),
                driverOrRuntime: 'Linux DRM / ROCm',
              });
            }
          }
        }
        if (gpus.length > 0) return { gpus, rocmVersion: 'Linux DRM' };
      }
    } catch {
      // ignore
    }
  }

  return { gpus: [], rocmVersion: null };
}

async function probeAppleSilicon(totalRamGb: number, freeRamGb: number): Promise<HardwareGpuInfo[]> {
  if (os.platform() !== 'darwin') return [];
  try {
    const { stdout } = await execFileAsync('system_profiler', ['SPDisplaysDataType', '-json'], {
      timeout: 4000,
    });
    const parsed = JSON.parse(stdout) as {
      SPDisplaysDataType?: Array<{
        sppci_model?: string;
        spdisplays_metal?: string;
        spdisplays_vram?: string;
      }>;
    };
    const displays = parsed.SPDisplaysDataType ?? [];
    return displays.map((d) => {
      const model = d.sppci_model || 'Apple GPU';
      const isApple = model.toLowerCase().includes('apple') || os.arch() === 'arm64';
      const vramGb = isApple ? Number((totalRamGb * 0.75).toFixed(2)) : 4;
      const freeVram = isApple ? Number((freeRamGb * 0.75).toFixed(2)) : 2;
      return {
        vendor: isApple ? 'apple' : 'unknown',
        name: model,
        vramTotalGb: vramGb,
        vramFreeGb: freeVram,
        driverOrRuntime: d.spdisplays_metal || 'Metal',
      };
    });
  } catch {
    return [];
  }
}

export async function detectHardware(customDir?: string): Promise<HardwareProfile> {
  const { modelsDir } = ensureKovaDirs();
  const diskTarget = customDir && fs.existsSync(customDir) ? customDir : modelsDir;

  const cpus = os.cpus();
  const cpuModel = cpus[0]?.model?.trim() || `${os.arch()} CPU`;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const totalRamGb = bytesToGb(totalMem);
  const freeRamGb = bytesToGb(freeMem);
  const disk = detectDiskSpace(diskTarget);

  const notes: string[] = [];
  const nvidia = await probeNvidiaGpus();
  const amd = nvidia.gpus.length === 0 ? await probeAmdGpus() : { gpus: [], rocmVersion: null };
  const appleGpus =
    nvidia.gpus.length === 0 && amd.gpus.length === 0 && os.platform() === 'darwin'
      ? await probeAppleSilicon(totalRamGb, freeRamGb)
      : [];

  const gpus = [...nvidia.gpus, ...amd.gpus, ...appleGpus];
  const gpuDetected = gpus.length > 0;
  const totalVramGb = Number(gpus.reduce((sum, g) => sum + g.vramTotalGb, 0).toFixed(2));
  const freeVramGb = Number(gpus.reduce((sum, g) => sum + g.vramFreeGb, 0).toFixed(2));

  let recommendedBackend: HardwareProfile['recommendedBackend'] = 'cpu';
  let backendVersion = 'CPU AVX2 / generic';

  if (nvidia.gpus.length > 0) {
    recommendedBackend = 'cuda';
    backendVersion = nvidia.cudaVersion || nvidia.gpus[0].driverOrRuntime;
  } else if (amd.gpus.length > 0) {
    recommendedBackend = 'rocm';
    backendVersion = amd.rocmVersion || 'ROCm';
  } else if (appleGpus.length > 0) {
    recommendedBackend = 'metal';
    backendVersion = appleGpus[0].driverOrRuntime;
  } else {
    notes.push('Дискретный GPU (CUDA/ROCm/Metal) не обнаружен — рекомендован CPU-режим через RAM.');
  }

  if (freeRamGb < 4) {
    notes.push(`Низкий объём свободной RAM (${freeRamGb} GB). Большие модели могут выгружаться в swap.`);
  }

  return {
    detectedAt: new Date().toISOString(),
    os: {
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
    },
    cpu: {
      model: cpuModel,
      cores: cpus.length || 1,
    },
    ram: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      totalGb: totalRamGb,
      freeGb: freeRamGb,
    },
    disk: {
      path: diskTarget,
      totalBytes: disk.totalBytes,
      freeBytes: disk.freeBytes,
      totalGb: bytesToGb(disk.totalBytes),
      freeGb: bytesToGb(disk.freeBytes),
    },
    gpuDetected,
    gpus,
    totalVramGb,
    freeVramGb,
    recommendedBackend,
    backendVersion,
    notes,
  };
}

export function recommendModelForHardware(
  model: ModelRecommendationInput,
  hw: HardwareProfile,
): ModelRecommendation {
  // Real memory footprint: weights size + KV cache/runtime overhead (~1.15x + 0.6 GB)
  const requiredVramGb = Number(
    (model.minVramGb ?? model.sizeGb * 1.15 + 0.7).toFixed(2),
  );
  const requiredRamGb = Number(
    (model.minRamGb ?? model.sizeGb * 1.2 + 1.2).toFixed(2),
  );
  const diskFits = hw.disk.freeGb === 0 ? true : model.sizeGb + 0.25 <= hw.disk.freeGb;

  const vramBudget = hw.freeVramGb > 0 ? hw.freeVramGb : hw.totalVramGb;
  const remainingVramAfterGb = Number((vramBudget - requiredVramGb).toFixed(2));
  const remainingRamAfterGb = Number((hw.freeRamGb - requiredRamGb).toFixed(2));

  if (!diskFits) {
    return {
      id: model.id,
      category: 'too-heavy',
      categoryLabel: 'Слишком тяжело',
      requiredVramGb,
      requiredRamGb,
      remainingVramAfterGb,
      remainingRamAfterGb,
      diskFits: false,
      reason: `Недостаточно места на диске: нужно ${model.sizeGb} GB, свободно ${hw.disk.freeGb} GB`,
      warning: 'Освободите место на диске перед скачиванием.',
      allowManualOverride: true,
    };
  }

  if (hw.gpuDetected && requiredVramGb <= vramBudget) {
    return {
      id: model.id,
      category: 'fits-vram',
      categoryLabel: 'Поместится в VRAM',
      requiredVramGb,
      requiredRamGb,
      remainingVramAfterGb,
      remainingRamAfterGb,
      diskFits: true,
      reason: `Вместится в VRAM (${requiredVramGb} GB из ${vramBudget} GB свободно · останется ${remainingVramAfterGb} GB)`,
      allowManualOverride: true,
    };
  }

  // Fits in system RAM (either total free RAM or <= 80% of total RAM if OS caches can be reclaimed)
  const effectiveRamBudget = Math.max(hw.freeRamGb, Number((hw.ram.totalGb * 0.78).toFixed(2)));
  if (requiredRamGb <= effectiveRamBudget) {
    const lowFreeWarn =
      requiredRamGb > hw.freeRamGb
        ? `Сейчас свободно ${hw.freeRamGb} GB RAM (всего ${hw.ram.totalGb} GB) — ОС может сжать файловый кэш.`
        : undefined;
    return {
      id: model.id,
      category: 'fits-ram',
      categoryLabel: 'Поместится в RAM (CPU)',
      requiredVramGb,
      requiredRamGb,
      remainingVramAfterGb,
      remainingRamAfterGb,
      diskFits: true,
      reason: hw.gpuDetected
        ? `Превышает VRAM (${vramBudget} GB), запуск в RAM/CPU (${requiredRamGb} GB из ${effectiveRamBudget} GB доступно)`
        : `GPU не найден, запуск на CPU в RAM (${requiredRamGb} GB из ${effectiveRamBudget} GB доступно)`,
      warning: lowFreeWarn,
      allowManualOverride: true,
    };
  }

  return {
    id: model.id,
    category: 'too-heavy',
    categoryLabel: 'Слишком тяжело',
    requiredVramGb,
    requiredRamGb,
    remainingVramAfterGb,
    remainingRamAfterGb,
    diskFits: true,
    reason: `Требуется ~${requiredRamGb} GB RAM (или ${requiredVramGb} GB VRAM), доступно ${hw.ram.totalGb} GB RAM / ${vramBudget} GB VRAM`,
    warning: 'Риск OOM / сильного свопинга. Можно выбрать более лёгкую квантизацию (Q4_K_M / 3B–7B) или скачать вручную.',
    allowManualOverride: true,
  };
}
