// 에셋 매니페스트 / 체험 카탈로그 로더.
// - asset-manifest.json: Codex 소유(public/models/asset-manifest.json, schema v1.0.0)
// - catalog.json: (building, spot, experience) → assetId 라우팅(엔진/게임 관심사)
export interface AssetAnimation {
  name: string;
  duration_seconds?: number;
  loop?: "once" | "repeat" | string;
  clamp_when_finished?: boolean;
  next?: string;
  start_state?: "hidden" | "visible" | string;
  end_state?: string;
}

export interface AssetEntry {
  id: string;
  version?: string;
  /** Codex 매니페스트의 실제 값(예: "emergent-artwork"). 계약 어휘와 표기가 다를 수 있어 string으로 수용. */
  category: string;
  status?: string;
  url: string;
  recommended_scale?: number;
  anchor?: { node?: string; type?: string; contact_plane?: string; placement?: string };
  bounds_gltf_m?: { min: number[]; max: number[]; size: number[] };
  animations?: AssetAnimation[];
  validation?: { mobile_webxr_device_tested?: boolean };
}

export interface AssetManifest {
  schema_version: string;
  project?: string;
  assets: AssetEntry[];
}

export interface CatalogExperience {
  assetId: string;
  alignment?: "hit-test" | "image-marker" | "manual";
}
export interface Catalog {
  buildings: Record<
    string,
    {
      title?: string;
      spots: Record<string, { experiences: Record<string, CatalogExperience> }>;
    }
  >;
}

export async function loadAssetManifest(url: string): Promise<AssetManifest> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`asset-manifest 로드 실패 (${res.status}) ${url}`);
  return (await res.json()) as AssetManifest;
}

export async function loadCatalog(url: string): Promise<Catalog> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new Error(`catalog 로드 실패 (${res.status}) ${url}`);
  return (await res.json()) as Catalog;
}

export function findAsset(manifest: AssetManifest, assetId: string): AssetEntry | undefined {
  return manifest.assets.find((a) => a.id === assetId);
}

export function resolveExperience(
  catalog: Catalog,
  buildingId: string,
  spotId: string,
  experienceId: string
): CatalogExperience | undefined {
  return catalog.buildings[buildingId]?.spots[spotId]?.experiences[experienceId];
}
