export type ExperienceId='starseed'|'black-uniform';
export interface Asset {url:string;sha256:string;bytes:number;mimeType:string}
export interface Experience {
  schemaVersion:1;id:ExperienceId;title:string;revision:string;
  launch:{path:string;userGestureRequired:true};
  assets:Record<string,Asset>;
  coordinates:{units:'meters';up:'+Y';rotation:'radians';placement:string};
  platforms:Record<string,unknown>;limitations:string[];
  scene:Record<string,unknown>;[key:string]:unknown;
}
export interface Catalog {schemaVersion:1;revision:string;experiences:Array<{id:ExperienceId;title:string;url:string}>}
export function createARClient(options?:{baseUrl?:string}):{
  getCatalog():Promise<Catalog>;getExperience(id:ExperienceId):Promise<Experience>;
  getLaunchUrl(id:ExperienceId):string;resolveAsset(asset:Asset):string;
};
