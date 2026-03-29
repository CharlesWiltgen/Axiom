---
name: axiom-metal-migration-diag
description: Use when ANY Metal porting issue occurs - black screen, rendering artifacts, shader errors, wrong colors, performance regressions, GPU crashes
license: MIT
compatibility: [iOS 12+, macOS 10.14+, tvOS 12+]
metadata:
  version: "1.0.0"
---

# Metal Migration Diagnostics

Systematic diagnosis for common Metal porting issues.

## When to Use This Diagnostic Skill

Use this skill when:
- Screen is black after porting to Metal
- Shaders fail to compile in Metal
- Colors or coordinates are wrong
- Performance is worse than the original
- Rendering artifacts appear
- App crashes during GPU work

## Mandatory First Step: Enable Metal Validation

**Time cost**: 30 seconds setup vs hours of blind debugging

Before ANY debugging, enable Metal validation:

```
Xcode → Edit Scheme → Run → Diagnostics
✓ Metal API Validation
✓ Metal Shader Validation
✓ GPU Frame Capture (Metal)
```

Most Metal bugs produce clear validation errors. If you're debugging without validation enabled, **stop and enable it first**.

## Symptom 1: Black Screen

### Decision Tree

```
Black screen after porting
│
├─ Are there Metal validation errors in console?
│   └─ YES → Fix validation errors first (see below)
│
├─ Is the render pass descriptor valid?
│   ├─ Check: view.currentRenderPassDescriptor != nil
│   ├─ Check: drawable = view.currentDrawable != nil
│   └─ FIX: Ensure MTKView.device is set, view is on screen
│
├─ Is the pipeline state created?
│   ├─ Check: makeRenderPipelineState doesn't throw
│   └─ FIX: Check shader function names match library
│
├─ Are draw calls being issued?
│   ├─ Add: encoder.label = "Main Pass" for frame capture
│   └─ DEBUG: GPU Frame Capture → verify draw calls appear
│
├─ Are resources bound?
│   ├─ Check: setVertexBuffer, setFragmentTexture called
│   └─ FIX: Metal requires explicit binding every frame
│
├─ Is the vertex data correct?
│   ├─ DEBUG: GPU Frame Capture → inspect vertex buffer
│   └─ FIX: Check buffer offsets, vertex count
│
├─ Are coordinates in Metal's range?
│   ├─ Metal NDC: X [-1,1], Y [-1,1], Z [0,1]
│   ├─ OpenGL NDC: X [-1,1], Y [-1,1], Z [-1,1]
│   └─ FIX: Adjust projection matrix or vertex shader
│
└─ Is clear color set?
    ├─ Default clear color is (0,0,0,0) — transparent black
    └─ FIX: Set view.clearColor or renderPassDescriptor.colorAttachments[0].clearColor
```

### Common Fixes

**Missing Drawable**:
```swift
// BAD: Drawing before view is ready
override func viewDidLoad() {
    draw()  // metalView.currentDrawable is nil
}

// GOOD: Wait for delegate callback
func draw(in view: MTKView) {
    guard let drawable = view.currentDrawable else { return }
    // Safe to draw
}
```

**Wrong Function Names**:
```swift
// BAD: Function name doesn't match .metal file
descriptor.vertexFunction = library.makeFunction(name: "vertexMain")
// .metal file has: vertex VertexOut vertexShader(...)

// GOOD: Names must match exactly
descriptor.vertexFunction = library.makeFunction(name: "vertexShader")
```

**Missing Resource Binding**:
```swift
// BAD: Assumed state persists like OpenGL
encoder.setRenderPipelineState(pso)
encoder.drawPrimitives(...)  // No buffers bound!

// GOOD: Bind everything explicitly
encoder.setRenderPipelineState(pso)
encoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)
encoder.setVertexBytes(&uniforms, length: uniformsSize, index: 1)
encoder.setFragmentTexture(texture, index: 0)
encoder.drawPrimitives(...)
```

**Time cost**: GPU Frame Capture diagnosis: 5-10 min. Guessing without tools: 1-4 hours.

## Symptom 2: Shader Compilation Errors

### Decision Tree

```
Shader fails to compile
│
├─ "Use of undeclared identifier"
│   ├─ Check: #include <metal_stdlib>
│   ├─ Check: using namespace metal;
│   └─ FIX: Standard functions need metal_stdlib
│
├─ "No matching function for call to 'texture'"
│   └─ GLSL texture() → MSL tex.sample(sampler, uv)
│       FIX: Texture sampling is a method, needs sampler
│
├─ "Invalid type 'vec4'"
│   └─ GLSL vec4 → MSL float4
│       FIX: See type mapping table in metal-migration-ref
│
├─ "No matching constructor"
│   ├─ GLSL: vec4(vec3, float) works
│   ├─ MSL: float4(float3, float) works
│   └─ Check: Argument types match exactly
│
├─ "Attribute index out of range"
│   ├─ Check: [[attribute(N)]] matches vertex descriptor
│   └─ FIX: vertexDescriptor.attributes[N] must be configured
│
├─ "Buffer binding index out of range"
│   ├─ Check: [[buffer(N)]] where N < 31
│   └─ FIX: Metal has max 31 buffer bindings per stage
│
└─ "Cannot convert value of type"
    ├─ MSL is stricter than GLSL about implicit conversions
    └─ FIX: Add explicit casts: float(intValue), int(floatValue)
```

### Common Conversions

```metal
// GLSL
vec4 color = texture(sampler2D, uv);

// MSL — texture and sampler are separate
float4 color = tex.sample(samp, uv);

// GLSL — mod() for floats
float x = mod(y, z);

// MSL — fmod() for floats
float x = fmod(y, z);

// GLSL — atan(y, x)
float angle = atan(y, x);

// MSL — atan2(y, x)
float angle = atan2(y, x);

// GLSL — inversesqrt
float invSqrt = inversesqrt(x);

// MSL — rsqrt
float invSqrt = rsqrt(x);
```

**Time cost**: With conversion table: 2-5 min per shader. Without: 15-30 min per shader.

## Symptom 3: Wrong Colors or Coordinates

### Decision Tree

```
Rendering looks wrong
│
├─ Image is upside down
│   ├─ Cause: Metal Y-axis is opposite OpenGL
│   ├─ FIX (vertex shader): pos.y = -pos.y
│   ├─ FIX (texture load): MTKTextureLoader .origin: .bottomLeft
│   └─ FIX (UV): uv.y = 1.0 - uv.y in fragment shader
│
├─ Image is mirrored
│   ├─ Cause: Winding order or cull mode wrong
│   ├─ FIX: encoder.setFrontFacing(.counterClockwise)
│   └─ FIX: encoder.setCullMode(.back) or .none to test
│
├─ Colors are swapped (red/blue)
│   ├─ Cause: Pixel format mismatch
│   ├─ Check: .bgra8Unorm vs .rgba8Unorm
│   └─ FIX: Match texture pixel format to data format
│
├─ Colors are washed out / too bright
│   ├─ Cause: sRGB vs linear color space
│   ├─ Check: Using .bgra8Unorm_srgb for sRGB textures?
│   └─ FIX: Use _srgb format variants for gamma-correct rendering
│
├─ Depth fighting / z-fighting
│   ├─ Cause: NDC Z range difference
│   ├─ OpenGL: Z in [-1, 1]
│   ├─ Metal: Z in [0, 1]
│   └─ FIX: Adjust projection matrix for Metal's Z range
│
├─ Objects clipped incorrectly
│   ├─ Cause: Near/far plane or viewport
│   ├─ Check: Viewport size matches drawable size
│   └─ FIX: encoder.setViewport(MTLViewport(...))
│
└─ Transparency wrong
    ├─ Cause: Blend state not configured
    ├─ FIX: pipelineDescriptor.colorAttachments[0].isBlendingEnabled = true
    └─ FIX: Set sourceRGBBlendFactor, destinationRGBBlendFactor
```

### Coordinate System Fix

```swift
// Fix projection matrix for Metal's Z range [0, 1]
func metalPerspectiveProjection(fovY: Float, aspect: Float, near: Float, far: Float) -> simd_float4x4 {
    let yScale = 1.0 / tan(fovY * 0.5)
    let xScale = yScale / aspect
    let zRange = far - near

    return simd_float4x4(rows: [
        SIMD4<Float>(xScale, 0, 0, 0),
        SIMD4<Float>(0, yScale, 0, 0),
        SIMD4<Float>(0, 0, far / zRange, 1),  // Metal: [0, 1]
        SIMD4<Float>(0, 0, -near * far / zRange, 0)
    ])
}
```

**Time cost**: With GPU Frame Capture texture inspection: 5-10 min. Without: 1-2 hours.

## Symptom 4: Performance Regression

### Decision Tree

```
Performance worse than OpenGL
│
├─ Enabling validation?
│   └─ Validation adds ~30% overhead
│       FIX: Disable for release builds, keep for debug
│
├─ Creating resources every frame?
│   ├─ BAD: device.makeBuffer() in draw()
│   └─ FIX: Create buffers once, reuse with triple buffering
│
├─ Creating pipeline state every frame?
│   ├─ BAD: makeRenderPipelineState() in draw()
│   └─ FIX: Create PSO once at init, store as property
│
├─ Too many draw calls?
│   ├─ DEBUG: GPU Frame Capture → count draw calls
│   └─ FIX: Batch geometry, use instancing, indirect draws
│
├─ GPU-CPU sync stalls?
│   ├─ DEBUG: Metal System Trace → look for stalls
│   ├─ Cause: waitUntilCompleted() blocks CPU
│   └─ FIX: Triple buffering with semaphore
│
├─ Inefficient buffer updates?
│   ├─ BAD: Recreating buffer to update
│   └─ FIX: buffer.contents().copyMemory() for dynamic data
│
├─ Wrong storage mode?
│   ├─ .shared: Good for small dynamic data
│   ├─ .private: Good for static GPU-only data
│   └─ FIX: Use .private for geometry that doesn't change
│
└─ Missing Metal-specific optimizations?
    ├─ Argument buffers reduce binding overhead
    ├─ Indirect draws reduce CPU work
    └─ See WWDC sessions on Metal optimization
```

### Triple Buffering Pattern

```swift
class TripleBufferedRenderer {
    static let maxInflightFrames = 3

    let inflightSemaphore = DispatchSemaphore(value: maxInflightFrames)
    var uniformBuffers: [MTLBuffer] = []
    var currentBufferIndex = 0

    init(device: MTLDevice) {
        for _ in 0..<Self.maxInflightFrames {
            let buffer = device.makeBuffer(length: uniformsSize, options: .storageModeShared)!
            uniformBuffers.append(buffer)
        }
    }

    func draw(in view: MTKView) {
        // Wait for a buffer to be available
        inflightSemaphore.wait()

        let buffer = uniformBuffers[currentBufferIndex]
        // Safe to write — GPU is done with this buffer
        memcpy(buffer.contents(), &uniforms, uniformsSize)

        let commandBuffer = commandQueue.makeCommandBuffer()!

        // Signal when GPU is done
        commandBuffer.addCompletedHandler { [weak self] _ in
            self?.inflightSemaphore.signal()
        }

        // ... encode and commit

        currentBufferIndex = (currentBufferIndex + 1) % Self.maxInflightFrames
    }
}
```

**Time cost**: Metal System Trace diagnosis: 15-30 min. Guessing: hours.

## Symptom 5: Crashes During GPU Work

### Decision Tree

```
App crashes during rendering
│
├─ EXC_BAD_ACCESS in Metal framework
│   ├─ Cause: Accessing released resource
│   ├─ Check: Buffer/texture retained during GPU use
│   └─ FIX: Keep strong references until command buffer completes
│
├─ "Execution of the command buffer was aborted"
│   ├─ Cause: GPU timeout (>10 sec on iOS)
│   ├─ Check: Infinite loop in shader?
│   └─ FIX: Add early exit conditions, reduce work
│
├─ "-[MTLDebugRenderCommandEncoder validateDrawCallWithArray:...]"
│   ├─ Cause: Validation caught misuse
│   └─ FIX: Read the validation message — it tells you exactly what's wrong
│
├─ "Fragment shader writes to non-existent render target"
│   ├─ Cause: Shader returns color but no color attachment
│   └─ FIX: Configure colorAttachments[0].pixelFormat
│
├─ Crash in shader (SIGABRT)
│   ├─ Cause: Out-of-bounds buffer access
│   ├─ DEBUG: Enable shader validation
│   └─ FIX: Check array bounds, buffer sizes
│
└─ Device disconnected / GPU restart
    ├─ Cause: Severe GPU hang
    ├─ Check: Infinite loop or massive overdraw
    └─ FIX: Simplify shader, reduce draw complexity
```

### Resource Lifetime Fix

```swift
// BAD: Buffer released before GPU finishes
func draw(in view: MTKView) {
    let buffer = device.makeBuffer(...)  // Created here
    encoder.setVertexBuffer(buffer, ...)
    commandBuffer.commit()
    // buffer released at end of scope — GPU still using it!
}

// GOOD: Keep reference until completion
class Renderer {
    var currentBuffer: MTLBuffer?  // Strong reference

    func draw(in view: MTKView) {
        currentBuffer = device.makeBuffer(...)
        encoder.setVertexBuffer(currentBuffer!, ...)
        commandBuffer.addCompletedHandler { [weak self] _ in
            // Safe to release now
            self?.currentBuffer = nil
        }
        commandBuffer.commit()
    }
}
```

## Debugging Tools Quick Reference

### GPU Frame Capture

```
Xcode → Debug → Capture GPU Frame (Cmd+Opt+Shift+G)
```

**Use for**:
- Inspecting buffer contents
- Viewing intermediate textures
- Checking draw call sequence
- Debugging shader variable values
- Understanding why something isn't rendering

### Metal System Trace (Instruments)

```
Instruments → Metal System Trace template
```

**Use for**:
- GPU/CPU timeline analysis
- Finding synchronization stalls
- Measuring encoder/buffer overhead
- Identifying bottlenecks

### Shader Debugger

```
GPU Frame Capture → Select draw call → Debug button
```

**Use for**:
- Step through shader execution
- Inspect variable values per pixel/vertex
- Find logic errors in shaders

### Validation Messages

Most validation messages include:
- What went wrong
- Which resource/state
- What the expected value was

**Always read the full message** — it usually tells you exactly how to fix the problem.

## Diagnostic Checklist

When something doesn't work:

- [ ] **Metal validation enabled?** (Most bugs produce validation errors)
- [ ] **GPU Frame Capture available?** (Visual debugging is fastest)
- [ ] **Console error messages?** (Read them fully)
- [ ] **Resources bound?** (Metal requires explicit binding)
- [ ] **Coordinates correct?** (Y-flip, NDC Z range)
- [ ] **Pipeline state created successfully?** (Check for throw)
- [ ] **Drawable available?** (View must be on screen)

## Resources

**WWDC**: 2019-00611, 2020-10602, 2020-10603

**Docs**: /metal/debugging-metal-applications, /metal/gpu-capture

**Skills**: axiom-metal-migration, axiom-metal-migration-ref

---

**Last Updated**: 2025-12-29
**Platforms**: iOS 12+, macOS 10.14+, tvOS 12+
**Status**: Comprehensive Metal porting diagnostics
