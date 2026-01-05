---
name: axiom-metal-migration
description: Use when porting OpenGL/DirectX to Metal - translation layer vs native rewrite decisions, migration planning, anti-patterns
skill_type: discipline
version: 1.0.0
apple_platforms: [iOS 12+, macOS 10.14+, tvOS 12+]
---

# Metal Migration

Porting OpenGL/OpenGL ES or DirectX code to Metal on Apple platforms.

## When to Use This Skill

Use this skill when:
- Porting an OpenGL/OpenGL ES codebase to iOS/macOS
- Porting a DirectX codebase to Apple platforms
- Deciding between translation layer (MetalANGLE) vs native rewrite
- Planning a phased migration strategy
- Evaluating effort vs performance tradeoffs

## Red Flags

❌ "Just use MetalANGLE and ship" — Translation layers add 10-30% overhead; fine for demos, not production

❌ "Convert shaders one-by-one without planning" — State management differs fundamentally; you'll rewrite twice

❌ "Keep the GL state machine mental model" — Metal is explicit; thinking GL causes subtle bugs

❌ "Port everything at once" — Phased migration catches issues early; big-bang migrations hide compounding bugs

❌ "Skip validation layer during development" — Metal validation catches 80% of porting bugs with clear messages

❌ "Worry about coordinate systems later" — Y-flip and NDC differences cause the most debugging time

❌ "Performance will be the same or better automatically" — Metal requires explicit optimization; naive ports can be slower

## Migration Strategy Decision Tree

```
Starting a port to Metal?
│
├─ Need working demo in <1 week?
│   ├─ OpenGL ES source? → MetalANGLE (translation layer)
│   │   └─ Caveats: 10-30% overhead, ES 2/3 only, no compute
│   │
│   └─ Vulkan available? → MoltenVK
│       └─ Caveats: Vulkan complexity, indirect translation
│
├─ Production app with performance requirements?
│   └─ Native Metal rewrite (recommended)
│       ├─ Phased: Keep GL for reference, port module-by-module
│       └─ Full: Clean rewrite using Metal idioms from start
│
├─ DirectX/HLSL source?
│   └─ Metal Shader Converter (Apple tool)
│       └─ Converts DXIL bytecode → Metal library
│       └─ See metal-migration-ref for usage
│
└─ Hybrid approach?
    └─ MetalANGLE for demo → Native Metal incrementally
        └─ Best of both: fast validation, optimal end state
```

## Pattern 1: Translation Layer (Quick Demo Path)

**When to use**: Validate feasibility, get stakeholder buy-in, prototype

### MetalANGLE Setup (OpenGL ES → Metal)

```swift
// 1. Add MetalANGLE via SPM or CocoaPods
// GitHub: nicklockwood/MetalANGLE

// 2. Replace EAGLContext with MGLContext
import MetalANGLE

let context = MGLContext(api: kMGLRenderingAPIOpenGLES3)
MGLContext.setCurrent(context)

// 3. Replace GLKView with MGLKView
let glView = MGLKView(frame: bounds, context: context)
glView.delegate = self
glView.drawableDepthFormat = .format24

// 4. Existing GL code works unchanged
glClearColor(0, 0, 0, 1)
glClear(GL_COLOR_BUFFER_BIT)
// ... your existing GL rendering code
```

### Tradeoffs Table

| Aspect | MetalANGLE | Native Metal |
|--------|------------|--------------|
| Time to demo | Hours | Days-weeks |
| Runtime overhead | 10-30% | Baseline |
| Shader changes | None | Full rewrite |
| Compute shaders | Not supported | Full support |
| Future-proof | Translation debt | Apple-recommended |
| Debugging | GL tools only | GPU Frame Capture |
| Thermal/battery | Higher | Optimizable |

### When MetalANGLE Fails

MetalANGLE will NOT work if your code:
- Uses OpenGL ES extensions not in core ES 2/3
- Relies on compute shaders (GL_COMPUTE_SHADER)
- Requires precise GL state machine semantics
- Needs performance within 10% of native
- Targets visionOS (no translation layer support)

## Pattern 2: Native Metal Rewrite (Production Path)

**When to use**: Production apps, performance-critical rendering, long-term maintenance

### Phased Migration Strategy

```
Phase 1: Abstraction Layer (1-2 weeks)
├─ Create renderer interface hiding GL/Metal specifics
├─ Keep GL implementation as reference
├─ Define clear boundaries: setup, resources, draw, present
└─ Validate abstraction with existing tests

Phase 2: Metal Backend (2-4 weeks)
├─ Implement Metal renderer behind same interface
├─ Convert shaders GLSL → MSL (use metal-migration-ref)
├─ Run GL and Metal side-by-side for visual diff
├─ GPU Frame Capture for debugging
└─ Milestone: Feature parity, visual match

Phase 3: Optimization (1-2 weeks)
├─ Remove abstraction overhead where it hurts
├─ Use Metal-specific features (argument buffers, indirect)
├─ Profile with Metal System Trace
├─ Tune for thermal envelope and battery
└─ Remove GL backend entirely
```

### Core Architecture Differences

| Concept | OpenGL | Metal |
|---------|--------|-------|
| State model | Implicit, mutable | Explicit, immutable PSO |
| Validation | At draw time | At PSO creation |
| Shader compilation | Runtime (JIT) | Build time (AOT) |
| Command submission | Implicit | Explicit command buffers |
| Resource binding | Global state | Per-encoder binding |
| Synchronization | Driver-managed | App-managed |

### MTKView Setup (Native Metal)

```swift
import MetalKit

class MetalRenderer: NSObject, MTKViewDelegate {
    let device: MTLDevice
    let commandQueue: MTLCommandQueue
    var pipelineState: MTLRenderPipelineState!

    init?(metalView: MTKView) {
        guard let device = MTLCreateSystemDefaultDevice(),
              let queue = device.makeCommandQueue() else {
            return nil
        }
        self.device = device
        self.commandQueue = queue

        metalView.device = device
        metalView.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        metalView.depthStencilPixelFormat = .depth32Float

        super.init()
        metalView.delegate = self

        buildPipeline(metalView: metalView)
    }

    private func buildPipeline(metalView: MTKView) {
        let library = device.makeDefaultLibrary()!
        let vertexFunction = library.makeFunction(name: "vertexShader")
        let fragmentFunction = library.makeFunction(name: "fragmentShader")

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = vertexFunction
        descriptor.fragmentFunction = fragmentFunction
        descriptor.colorAttachments[0].pixelFormat = metalView.colorPixelFormat
        descriptor.depthAttachmentPixelFormat = metalView.depthStencilPixelFormat

        // Pre-validated at creation, not at draw time
        pipelineState = try! device.makeRenderPipelineState(descriptor: descriptor)
    }

    func draw(in view: MTKView) {
        guard let drawable = view.currentDrawable,
              let descriptor = view.currentRenderPassDescriptor,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else {
            return
        }

        encoder.setRenderPipelineState(pipelineState)
        // Bind resources explicitly - nothing persists between draws
        encoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)
        encoder.setFragmentTexture(texture, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: vertexCount)
        encoder.endEncoding()

        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
```

## Common Migration Anti-Patterns

### Anti-Pattern 1: Keeping GL State Machine Mentality

❌ **BAD** — Thinking in GL's implicit state:
```swift
// GL mental model: "set state, then draw"
glBindTexture(GL_TEXTURE_2D, texture)
glBindBuffer(GL_ARRAY_BUFFER, vbo)
glUseProgram(program)
glDrawArrays(GL_TRIANGLES, 0, vertexCount)
// State persists until changed — can draw again without rebinding
```

✅ **GOOD** — Metal's explicit model:
```swift
// Metal: encode everything explicitly per draw
let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: rpd)!
encoder.setRenderPipelineState(pipelineState)    // Always set
encoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)  // Always bind
encoder.setFragmentTexture(texture, index: 0)    // Always bind
encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: count)
encoder.endEncoding()
// Nothing persists — next encoder starts fresh
```

**Time cost**: 30-60 min debugging "why did my texture disappear" vs 2 min understanding the model upfront.

### Anti-Pattern 2: Ignoring Coordinate System Differences

❌ **BAD** — Assuming GL coordinates work in Metal:
```
OpenGL:
- Origin: bottom-left
- Y-axis: up
- NDC Z range: [-1, 1]
- Texture origin: bottom-left

Metal:
- Origin: top-left
- Y-axis: down
- NDC Z range: [0, 1]
- Texture origin: top-left
```

✅ **GOOD** — Explicit coordinate handling:
```metal
// Option 1: Flip Y in vertex shader
vertex float4 vertexShader(VertexIn in [[stage_in]]) {
    float4 pos = uniforms.mvp * float4(in.position, 1.0);
    pos.y = -pos.y;  // Flip Y for Metal's coordinate system
    return pos;
}

// Option 2: Flip texture coordinates in fragment shader
fragment float4 fragmentShader(VertexOut in [[stage_in]],
                                texture2d<float> tex [[texture(0)]],
                                sampler samp [[sampler(0)]]) {
    float2 uv = in.texCoord;
    uv.y = 1.0 - uv.y;  // Flip V for Metal's texture origin
    return tex.sample(samp, uv);
}
```

```swift
// Option 3: Use MTKTextureLoader with origin option
let options: [MTKTextureLoader.Option: Any] = [
    .origin: MTKTextureLoader.Origin.bottomLeft  // Match GL convention
]
let texture = try textureLoader.newTexture(URL: url, options: options)
```

**Time cost**: 2-4 hours debugging "upside down" or "mirrored" rendering vs 5 min reading this pattern.

### Anti-Pattern 3: No Validation Layer During Development

❌ **BAD** — Disabling validation for "performance":
```swift
// No validation — API misuse silently corrupts or crashes later
```

✅ **GOOD** — Always enable during development:
```
In Xcode: Edit Scheme → Run → Diagnostics
✓ Metal API Validation
✓ Metal Shader Validation
✓ GPU Frame Capture (Metal)
```

**Time cost**: Hours debugging silent corruption vs immediate error messages with call stacks.

### Anti-Pattern 4: Single Buffer Without Synchronization

❌ **BAD** — CPU and GPU fight over same buffer:
```swift
// Frame N: CPU writes to buffer
// Frame N: GPU reads from buffer
// Frame N+1: CPU writes again — RACE CONDITION
buffer.contents().copyMemory(from: data, byteCount: size)
```

✅ **GOOD** — Triple buffering with semaphore:
```swift
class TripleBufferedRenderer {
    let inflightSemaphore = DispatchSemaphore(value: 3)
    var buffers: [MTLBuffer] = []
    var bufferIndex = 0

    func draw(in view: MTKView) {
        // Wait for a buffer to become available
        inflightSemaphore.wait()

        let buffer = buffers[bufferIndex]
        // Safe to write — GPU finished with this buffer
        buffer.contents().copyMemory(from: data, byteCount: size)

        let commandBuffer = commandQueue.makeCommandBuffer()!
        commandBuffer.addCompletedHandler { [weak self] _ in
            self?.inflightSemaphore.signal()  // Release buffer
        }

        // ... encode and commit

        bufferIndex = (bufferIndex + 1) % 3
    }
}
```

**Time cost**: Hours debugging intermittent visual glitches vs 15 min implementing triple buffering.

## Pressure Scenarios

### Scenario 1: "Just Ship with MetalANGLE"

**Situation**: Deadline in 2 weeks. MetalANGLE demo works. PM says ship it.

**Pressure**: "We can optimize later. Users won't notice 20% overhead."

**Why this fails**:
- Translation overhead compounds with complex scenes (visualizers, games)
- No compute shader support limits future features
- Technical debt grows — team learns MetalANGLE quirks, not Metal
- Apple deprecation risk (OpenGL ES deprecated since iOS 12)
- Battery/thermal complaints from users

**Response template**:
> "MetalANGLE is viable for the demo milestone. For production, I recommend a 3-week buffer to implement native Metal for the render loop. This recovers the 20-30% overhead and eliminates deprecation risk. Can we scope the MVP to fewer visual effects to hit the deadline with native Metal?"

### Scenario 2: "Port All Shaders This Sprint"

**Situation**: 50 GLSL shaders. Sprint is 2 weeks. Manager wants all converted.

**Pressure**: "They're just text files. How hard can shader conversion be?"

**Why this fails**:
- GLSL → MSL isn't 1:1 (precision qualifiers, built-ins, sampling)
- Each shader needs visual validation, not just compilation
- Complex shaders need performance profiling
- Bugs compound — broken shader A masks broken shader B

**Response template**:
> "Shader conversion requires visual validation, not just compilation. I can convert 10-15 shaders/week with confidence. For 50 shaders: (1) Prioritize by usage — convert the 10 most-used first, (2) Automate mappings — type conversions, boilerplate, (3) Parallel validation — run GL and Metal side-by-side. Realistic timeline: 4-5 weeks for full conversion with quality."

### Scenario 3: "We Don't Need GPU Frame Capture"

**Situation**: Developer says "I'll just use print statements to debug shaders."

**Pressure**: "GPU tools are overkill. I know what I'm doing."

**Why this fails**:
- Print statements don't work in shaders
- Visual bugs require seeing intermediate render targets
- Performance issues require GPU timeline analysis
- Metal validation errors need call stack context

**Response template**:
> "GPU Frame Capture is the only way to inspect shader variables, see intermediate textures, and understand GPU timing. It takes 30 seconds to capture a frame. Without it, shader debugging is 10x slower — you're guessing instead of observing."

## Pre-Migration Checklist

Before starting any port:

- [ ] **Inventory shaders**: Count GLSL/HLSL files, complexity (LOC, features used)
- [ ] **Identify extensions**: Which GL extensions does the code use? Metal equivalents?
- [ ] **Audit state management**: How stateful is the renderer? Global state count?
- [ ] **Check compute usage**: Any GL compute shaders? GPGPU? (MetalANGLE won't help)
- [ ] **Profile baseline**: FPS, frame time, memory, thermal on reference platform
- [ ] **Define success criteria**: Target FPS, memory budget, thermal envelope
- [ ] **Set up A/B testing**: Can you run GL and Metal side-by-side for validation?
- [ ] **Enable validation**: Metal API Validation, Shader Validation, Frame Capture

## Post-Migration Checklist

After completing the port:

- [ ] **Visual parity**: Side-by-side screenshots match reference
- [ ] **Performance parity or better**: Frame time ≤ GL baseline
- [ ] **No validation errors**: Clean run with Metal validation enabled
- [ ] **Thermal acceptable**: Device doesn't throttle during normal use
- [ ] **Memory stable**: No leaks over extended use
- [ ] **All code paths tested**: Edge cases, error states, resize/rotate

## Resources

**WWDC**: 2016-00602, 2018-00604, 2019-00611

**Docs**: /metal/migrating-opengl-code-to-metal, /metal/shader-converter

**Tools**: MetalANGLE, MoltenVK

**Skills**: axiom-metal-migration-ref, axiom-metal-migration-diag

---

**Last Updated**: 2025-12-29
**Platforms**: iOS 12+, macOS 10.14+, tvOS 12+
**Status**: Production-ready Metal migration patterns
