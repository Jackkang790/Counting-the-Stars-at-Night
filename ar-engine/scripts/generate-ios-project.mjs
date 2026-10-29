import { createHash } from "node:crypto";
import { mkdirSync,readdirSync,writeFileSync } from "node:fs";
import { resolve } from "node:path";
const root=resolve(import.meta.dirname,"../ios/StarStage"), project=resolve(root,"StarStage.xcodeproj");
const id=name=>createHash("sha256").update(name).digest("hex").slice(0,24).toUpperCase();
const q=JSON.stringify;
const sources=readdirSync(root).filter(p=>p.endsWith(".swift")).sort();
const resources=["show.json","actor-a-demo.mp4","actor-b-demo.mp4","MEDIA-CREDITS.md"];
const definitions=[];
function add(name,value){definitions.push(`${id(name)} = ${value};`);return id(name)}
const sourceRefs=sources.map(name=>add("file:"+name,`{isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${q(name)}; sourceTree = "<group>";}`));
const resourceRefs=resources.map(name=>add("file:"+name,`{isa = PBXFileReference; lastKnownFileType = ${name.endsWith("mp4")?"file":name.endsWith("json")?"text.json":"text"}; name = ${q(name)}; path = ${q("../../musical-assets/"+name)}; sourceTree = SOURCE_ROOT;}`));
const sourceBuild=sources.map(name=>add("build:"+name,`{isa = PBXBuildFile; fileRef = ${id("file:"+name)};}`));
const resourceBuild=resources.map(name=>add("build:"+name,`{isa = PBXBuildFile; fileRef = ${id("file:"+name)};}`));
const product=add("product",'{isa = PBXFileReference; explicitFileType = wrapper.application; path = StarStage.app; sourceTree = BUILT_PRODUCTS_DIR;}');
const products=add("products",`{isa = PBXGroup; children = (${product},); name = Products; sourceTree = "<group>";}`);
const plist=add("plist",'{isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>";}');
const main=add("main",`{isa = PBXGroup; children = (${[...sourceRefs,...resourceRefs,plist,products].join(",")},); sourceTree = "<group>";}`);
const src=add("sources",`{isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = (${sourceBuild.join(",")},); runOnlyForDeploymentPostprocessing = 0;}`);
const res=add("resources",`{isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = (${resourceBuild.join(",")},); runOnlyForDeploymentPostprocessing = 0;}`);
const frameworks=add("frameworks",'{isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;}');
for(const config of ["Debug","Release"]){
 add("project:"+config,`{isa = XCBuildConfiguration; buildSettings = { SDKROOT = iphoneos; IPHONEOS_DEPLOYMENT_TARGET = 17.0; CLANG_ENABLE_MODULES = YES; }; name = ${config};}`);
 add("target:"+config,`{isa = XCBuildConfiguration; buildSettings = { PRODUCT_NAME = "$(TARGET_NAME)"; PRODUCT_BUNDLE_IDENTIFIER = com.lobodoc.starstage.demo; INFOPLIST_FILE = Info.plist; GENERATE_INFOPLIST_FILE = NO; SWIFT_VERSION = 5.0; SWIFT_STRICT_CONCURRENCY = minimal; TARGETED_DEVICE_FAMILY = "1,2"; CODE_SIGN_STYLE = Automatic; DEVELOPMENT_TEAM = ""; SWIFT_OPTIMIZATION_LEVEL = ${q(config==="Debug"?"-Onone":"-O")}; ${config==="Debug"?'SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;':''} }; name = ${config};}`);
}
const configs=scope=>add("configs:"+scope,`{isa = XCConfigurationList; buildConfigurations = (${id(scope+":Debug")},${id(scope+":Release")},); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;}`);
const projectConfigs=configs("project"), targetConfigs=configs("target");
const target=add("target",`{isa = PBXNativeTarget; buildConfigurationList = ${targetConfigs}; buildPhases = (${src},${frameworks},${res},); buildRules = (); dependencies = (); name = StarStage; productName = StarStage; productReference = ${product}; productType = "com.apple.product-type.application";}`);
add("project",`{isa = PBXProject; attributes = { LastUpgradeCheck = 1600; TargetAttributes = { ${target} = { CreatedOnToolsVersion = 16.0; }; }; }; buildConfigurationList = ${projectConfigs}; compatibilityVersion = "Xcode 14.0"; developmentRegion = ko; hasScannedForEncodings = 0; knownRegions = (ko,en,Base,); mainGroup = ${main}; productRefGroup = ${products}; projectDirPath = ""; projectRoot = ""; targets = (${target},);}`);
mkdirSync(project,{recursive:true});writeFileSync(resolve(project,"project.pbxproj"),`// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n${definitions.join("\n")}\n}; rootObject = ${id("project")}; }\n`);
const scheme=resolve(project,"xcshareddata/xcschemes");mkdirSync(scheme,{recursive:true});
const ref=`<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="${target}" BuildableName="StarStage.app" BlueprintName="StarStage" ReferencedContainer="container:StarStage.xcodeproj"/>`;
writeFileSync(resolve(scheme,"StarStage.xcscheme"),`<?xml version="1.0" encoding="UTF-8"?><Scheme LastUpgradeVersion="1600" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">${ref}</BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">${ref}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release"><BuildableProductRunnable runnableDebuggingMode="0">${ref}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>`);
console.log(`Generated ${project}; ${sources.length} Swift sources and ${resources.length} shared resources.`);
