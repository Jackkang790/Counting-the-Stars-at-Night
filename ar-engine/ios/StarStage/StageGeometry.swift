import SceneKit

/// Stage-local meters / Y up / -Z front, shared with musical-assets/show.json.
final class StageGeometry {
    let root = SCNNode(), building = SCNNode(), occlusion = SCNNode(), effects = SCNNode()
    private let glow = SCNMaterial()
    let anchors: [String: SCNVector3]
    init(_ config: Show.Building) {
        root.name = "MUSICAL_STAGE"; building.name = "BUILDING"; occlusion.name = "OCCLUSION"
        root.addChildNode(building); root.addChildNode(occlusion); root.addChildNode(effects)
        anchors = ["door": SCNVector3(Float(config.door.x),Float(config.door.y-config.door.height/2),0), "panel": SCNVector3(Float(config.panel.x),Float(config.panel.y-config.panel.height/2),0)]
        let wood = SCNMaterial(); wood.diffuse.contents = UIColor.brown
        let depth = SCNMaterial(); depth.colorBufferWriteMask = []; depth.writesToDepthBuffer = true; depth.isDoubleSided = true
        glow.lightingModel = .constant; glow.diffuse.contents = UIColor.orange; glow.emission.contents = UIColor.orange
        func box(_ w: Double,_ h: Double,_ d: Double,_ x: Double,_ y: Double,_ z: Double,_ material: SCNMaterial,_ parent: SCNNode) {
            let geometry = SCNBox(width: CGFloat(w),height: CGFloat(h),length: CGFloat(d),chamferRadius: 0)
            geometry.materials = [material]; let node = SCNNode(geometry: geometry); node.position = SCNVector3(Float(x),Float(y),Float(z)); parent.addChildNode(node)
        }
        for x in [-config.width/2,-0.65,1.9,config.width/2] {
            box(0.13,config.height,config.depth,x,config.height/2,-0.06,wood,building)
            box(0.13,config.height,config.depth,x,config.height/2,-0.06,depth,occlusion)
            box(0.012,config.height,0.01,x,config.height/2,-0.14,glow,effects)
        }
        for y in [0.26,config.height-0.05,1.98] { box(config.width,0.08,config.depth,0,y,-0.05,wood,building) }
        for i in 0...18 { box(0.023,config.door.height,0.035,config.door.x-config.door.width/2+Double(i)*config.door.width/18,config.door.y,-0.06,wood,building) }
        for i in 0...12 { box(config.door.width,0.023,0.035,config.door.x,config.door.y-config.door.height/2+Double(i)*config.door.height/12,-0.06,wood,building) }
        building.isHidden = true; occlusion.isHidden = true
    }
    func sample(_ time: Double, show: Show) {
        let cue = show.cues.first { time >= $0.start && time < $0.end }
        effects.opacity = CGFloat((cue?.light ?? 0) * (0.75+sin(time*3.5)*0.2))
    }
}
