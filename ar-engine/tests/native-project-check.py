"""Resource/project validation only. Does NOT compile Swift or validate device AR."""
import json, pathlib, plistlib, re, xml.etree.ElementTree as ET
root = pathlib.Path(__file__).resolve().parents[1]
project = root / 'ios/StarStage'
pbx = (project / 'StarStage.xcodeproj/project.pbxproj').read_text(encoding='utf-8')
definitions = re.findall(r'^([A-F0-9]{24}) = ', pbx, re.M)
references = set(re.findall(r'\b[A-F0-9]{24}\b', pbx))
assert len(definitions) == len(set(definitions)) and references == set(definitions)
for source in project.glob('*.swift'):
    assert f'path = "{source.name}"' in pbx
resources = re.findall(r'path = "(\.\./\.\./musical-assets/[^"\n]+)"', pbx)
assert len(resources) == 4
for resource in resources:
    assert (project / resource).resolve().is_file(), resource
with (project / 'Info.plist').open('rb') as stream:
    info = plistlib.load(stream)
assert info['NSCameraUsageDescription'] and 'arkit' in info['UIRequiredDeviceCapabilities']
assert 'starstage' in info['CFBundleURLTypes'][0]['CFBundleURLSchemes']
scheme = ET.parse(project / 'StarStage.xcodeproj/xcshareddata/xcschemes/StarStage.xcscheme')
assert scheme.find('.//BuildableReference').attrib['BlueprintIdentifier'] in references
show = json.loads((root / 'musical-assets/show.json').read_text(encoding='utf-8'))
assert show['duration'] == 30 and len(show['actors']) == 2
print(json.dumps(dict(result='PASS', projectObjects=len(definitions), sharedResources=len(resources),
    swiftSources=len(list(project.glob('*.swift'))), swiftCompiled=False, iPhoneARVerified=False), indent=2))
