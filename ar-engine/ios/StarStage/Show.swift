import Foundation

struct Show: Decodable {
    let id: String
    let duration: Double
    let building: Building
    let actors: [Actor]
    let cues: [Cue]
    struct Building: Decodable {
        let width, height, depth: Double
        let door, panel: Panel
    }
    struct Panel: Decodable { let x, y, width, height: Double }
    struct Actor: Decodable {
        let id, label, anchor, mode: String
        let position, rotation: [Double]
        let height, width, start, end, fadeIn, fadeOut, mediaOffset: Double
        let loop: Bool
        func opacity(at t: Double) -> Double {
            guard t >= start && t < end else { return 0 }
            return min(1, min((t-start)/max(0.001,fadeIn), (end-t)/max(0.001,fadeOut)))
        }
    }
    struct Cue: Decodable { let start, end, light, particles: Double }
    static func load() throws -> Show {
        guard let url = Bundle.main.url(forResource: "show", withExtension: "json") else { throw Failure.message("공연 데이터 누락") }
        let show = try JSONDecoder().decode(Show.self, from: Data(contentsOf: url))
        guard show.duration == 30, show.actors.count == 2,
              show.actors.allSatisfy({ $0.position.count == 3 && $0.rotation.count == 3 && $0.mode == "packed" && $0.end > $0.start }) else { throw Failure.message("공연 데이터 형식을 확인하세요") }
        return show
    }
}
enum Failure: LocalizedError {
    case message(String)
    var errorDescription: String? { if case let .message(text) = self { return text }; return nil }
}

// Same synthetic score as the web demo; no unlicensed external audio.
enum DemoScore {
    static func wav(seconds: Double) -> Data {
        let rate = 22050, count = Int(seconds * Double(rate))
        var pcm = Data(capacity: count * 2)
        let notes = [220.0, 261.63, 329.63, 293.66]
        for i in 0..<count {
            let t = Double(i)/Double(rate), beat = t.truncatingRemainder(dividingBy: 0.5)
            let envelope = min(1,beat/0.015) * exp(-beat*8) * min(1,(seconds-t)/2)
            let f = notes[Int(t/0.5) % notes.count]
            var value = Int16(32767 * 0.09 * envelope * (sin(2 * .pi * f * t) + 0.25 * sin(4 * .pi * f * t))).littleEndian
            withUnsafeBytes(of: &value) { pcm.append(contentsOf: $0) }
        }
        var data = Data("RIFF".utf8)
        func u32(_ n: Int) { var x = UInt32(n).littleEndian; withUnsafeBytes(of: &x) { data.append(contentsOf: $0) } }
        func u16(_ n: Int) { var x = UInt16(n).littleEndian; withUnsafeBytes(of: &x) { data.append(contentsOf: $0) } }
        u32(36+pcm.count); data.append(Data("WAVEfmt ".utf8)); u32(16); u16(1); u16(1)
        u32(rate); u32(rate*2); u16(2); u16(16); data.append(Data("data".utf8)); u32(pcm.count); data.append(pcm)
        return data
    }
}
