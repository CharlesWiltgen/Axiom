---
name: axiom-metal-migration-ref
description: Use when converting shaders or looking up API equivalents - GLSL to MSL, HLSL to MSL, GL/DirectX to Metal mappings, MTKView setup code
user-invocable: true
skill_type: reference
version: 1.0.0
apple_platforms: [iOS 12+, macOS 10.14+, tvOS 12+]
---

# Metal Migration Reference

Complete reference for converting OpenGL/DirectX code to Metal.

## When to Use This Reference

Use this reference when:
- Converting GLSL shaders to Metal Shading Language (MSL)
- Converting HLSL shaders to MSL
- Looking up GL/D3D API equivalents in Metal
- Setting up MTKView or CAMetalLayer
- Building render pipelines
- Using Metal Shader Converter for DirectX

## Part 1: GLSL to MSL Conversion

### Type Mappings

| GLSL | MSL | Notes |
|------|-----|-------|
| `void` | `void` | |
| `bool` | `bool` | |
| `int` | `int` | 32-bit signed |
| `uint` | `uint` | 32-bit unsigned |
| `float` | `float` | 32-bit |
| `double` | N/A | Use `float` (no 64-bit float in MSL) |
| `vec2` | `float2` | |
| `vec3` | `float3` | |
| `vec4` | `float4` | |
| `ivec2` | `int2` | |
| `ivec3` | `int3` | |
| `ivec4` | `int4` | |
| `uvec2` | `uint2` | |
| `uvec3` | `uint3` | |
| `uvec4` | `uint4` | |
| `bvec2` | `bool2` | |
| `bvec3` | `bool3` | |
| `bvec4` | `bool4` | |
| `mat2` | `float2x2` | |
| `mat3` | `float3x3` | |
| `mat4` | `float4x4` | |
| `mat2x3` | `float2x3` | Columns x Rows |
| `mat3x4` | `float3x4` | |
| `sampler2D` | `texture2d<float>` + `sampler` | Separate in MSL |
| `sampler3D` | `texture3d<float>` + `sampler` | |
| `samplerCube` | `texturecube<float>` + `sampler` | |
| `sampler2DArray` | `texture2d_array<float>` + `sampler` | |
| `sampler2DShadow` | `depth2d<float>` + `sampler` | |

### Built-in Variable Mappings

| GLSL | MSL | Stage |
|------|-----|-------|
| `gl_Position` | Return `[[position]]` | Vertex |
| `gl_PointSize` | Return `[[point_size]]` | Vertex |
| `gl_VertexID` | `[[vertex_id]]` parameter | Vertex |
| `gl_InstanceID` | `[[instance_id]]` parameter | Vertex |
| `gl_FragCoord` | `[[position]]` parameter | Fragment |
| `gl_FrontFacing` | `[[front_facing]]` parameter | Fragment |
| `gl_PointCoord` | `[[point_coord]]` parameter | Fragment |
| `gl_FragDepth` | Return `[[depth(any)]]` | Fragment |
| `gl_SampleID` | `[[sample_id]]` parameter | Fragment |
| `gl_SamplePosition` | `[[sample_position]]` parameter | Fragment |

### Function Mappings

| GLSL | MSL | Notes |
|------|-----|-------|
| `texture(sampler, uv)` | `tex.sample(sampler, uv)` | Method on texture |
| `textureLod(sampler, uv, lod)` | `tex.sample(sampler, uv, level(lod))` | |
| `textureGrad(sampler, uv, ddx, ddy)` | `tex.sample(sampler, uv, gradient2d(ddx, ddy))` | |
| `texelFetch(sampler, coord, lod)` | `tex.read(coord, lod)` | Integer coords |
| `textureSize(sampler, lod)` | `tex.get_width(lod)`, `tex.get_height(lod)` | Separate calls |
| `dFdx(v)` | `dfdx(v)` | |
| `dFdy(v)` | `dfdy(v)` | |
| `fwidth(v)` | `fwidth(v)` | Same |
| `mix(a, b, t)` | `mix(a, b, t)` | Same |
| `clamp(v, lo, hi)` | `clamp(v, lo, hi)` | Same |
| `smoothstep(e0, e1, x)` | `smoothstep(e0, e1, x)` | Same |
| `step(edge, x)` | `step(edge, x)` | Same |
| `mod(x, y)` | `fmod(x, y)` | Different name |
| `fract(x)` | `fract(x)` | Same |
| `inversesqrt(x)` | `rsqrt(x)` | Different name |
| `atan(y, x)` | `atan2(y, x)` | Different name |

### Shader Structure Conversion

**GLSL Vertex Shader**:
```glsl
#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec2 aTexCoord;

uniform mat4 uModelViewProjection;

out vec2 vTexCoord;

void main() {
    gl_Position = uModelViewProjection * vec4(aPosition, 1.0);
    vTexCoord = aTexCoord;
}
```

**MSL Vertex Shader**:
```metal
#include <metal_stdlib>
using namespace metal;

struct VertexIn {
    float3 position [[attribute(0)]];
    float2 texCoord [[attribute(1)]];
};

struct VertexOut {
    float4 position [[position]];
    float2 texCoord;
};

struct Uniforms {
    float4x4 modelViewProjection;
};

vertex VertexOut vertexShader(
    VertexIn in [[stage_in]],
    constant Uniforms& uniforms [[buffer(1)]]
) {
    VertexOut out;
    out.position = uniforms.modelViewProjection * float4(in.position, 1.0);
    out.texCoord = in.texCoord;
    return out;
}
```

**GLSL Fragment Shader**:
```glsl
#version 300 es
precision highp float;

in vec2 vTexCoord;
uniform sampler2D uTexture;

out vec4 fragColor;

void main() {
    fragColor = texture(uTexture, vTexCoord);
}
```

**MSL Fragment Shader**:
```metal
fragment float4 fragmentShader(
    VertexOut in [[stage_in]],
    texture2d<float> tex [[texture(0)]],
    sampler samp [[sampler(0)]]
) {
    return tex.sample(samp, in.texCoord);
}
```

### Precision Qualifiers

GLSL precision qualifiers have no direct MSL equivalent — MSL uses explicit types:

| GLSL | MSL Equivalent |
|------|----------------|
| `lowp float` | `half` (16-bit) |
| `mediump float` | `half` (16-bit) |
| `highp float` | `float` (32-bit) |
| `lowp int` | `short` (16-bit) |
| `mediump int` | `short` (16-bit) |
| `highp int` | `int` (32-bit) |

### Buffer Alignment (Critical)

**GLSL/C assumes**:
- `vec3`: 12 bytes, any alignment
- `vec4`: 16 bytes

**MSL requires**:
- `float3`: 12 bytes storage, **16-byte aligned**
- `float4`: 16 bytes storage, 16-byte aligned

**Solution**: Use `simd` types in Swift for CPU-GPU shared structs:

```swift
import simd

struct Uniforms {
    var modelViewProjection: simd_float4x4  // Correct alignment
    var cameraPosition: simd_float3         // 16-byte aligned
    var padding: Float = 0                   // Explicit padding if needed
}
```

Or use packed types in MSL (slower):
```metal
struct VertexPacked {
    packed_float3 position;  // 12 bytes, no padding
    packed_float2 texCoord;  // 8 bytes
};
```

## Part 2: HLSL to MSL Conversion

### Type Mappings

| HLSL | MSL | Notes |
|------|-----|-------|
| `float` | `float` | |
| `float2` | `float2` | |
| `float3` | `float3` | |
| `float4` | `float4` | |
| `half` | `half` | |
| `int` | `int` | |
| `uint` | `uint` | |
| `bool` | `bool` | |
| `float2x2` | `float2x2` | |
| `float3x3` | `float3x3` | |
| `float4x4` | `float4x4` | |
| `Texture2D` | `texture2d<float>` | |
| `Texture3D` | `texture3d<float>` | |
| `TextureCube` | `texturecube<float>` | |
| `SamplerState` | `sampler` | |
| `RWTexture2D` | `texture2d<float, access::read_write>` | |
| `RWBuffer` | `device float* [[buffer(n)]]` | |
| `StructuredBuffer` | `constant T* [[buffer(n)]]` | |
| `RWStructuredBuffer` | `device T* [[buffer(n)]]` | |

### Semantic Mappings

| HLSL Semantic | MSL Attribute |
|---------------|---------------|
| `SV_Position` | `[[position]]` |
| `SV_Target0` | Return value / `[[color(0)]]` |
| `SV_Target1` | `[[color(1)]]` |
| `SV_Depth` | `[[depth(any)]]` |
| `SV_VertexID` | `[[vertex_id]]` |
| `SV_InstanceID` | `[[instance_id]]` |
| `SV_IsFrontFace` | `[[front_facing]]` |
| `SV_SampleIndex` | `[[sample_id]]` |
| `SV_PrimitiveID` | `[[primitive_id]]` |
| `SV_DispatchThreadID` | `[[thread_position_in_grid]]` |
| `SV_GroupThreadID` | `[[thread_position_in_threadgroup]]` |
| `SV_GroupID` | `[[threadgroup_position_in_grid]]` |
| `SV_GroupIndex` | `[[thread_index_in_threadgroup]]` |

### Function Mappings

| HLSL | MSL | Notes |
|------|-----|-------|
| `tex.Sample(samp, uv)` | `tex.sample(samp, uv)` | Lowercase |
| `tex.SampleLevel(samp, uv, lod)` | `tex.sample(samp, uv, level(lod))` | |
| `tex.SampleGrad(samp, uv, ddx, ddy)` | `tex.sample(samp, uv, gradient2d(ddx, ddy))` | |
| `tex.Load(coord)` | `tex.read(coord.xy, coord.z)` | Split coord |
| `mul(a, b)` | `a * b` | Operator |
| `saturate(x)` | `saturate(x)` | Same |
| `lerp(a, b, t)` | `mix(a, b, t)` | Different name |
| `frac(x)` | `fract(x)` | Different name |
| `ddx(v)` | `dfdx(v)` | Different name |
| `ddy(v)` | `dfdy(v)` | Different name |
| `clip(x)` | `if (x < 0) discard_fragment()` | Manual |
| `discard` | `discard_fragment()` | Function call |

### Metal Shader Converter (DirectX → Metal)

Apple's official tool for converting DXIL (compiled HLSL) to Metal libraries.

**Requirements**:
- macOS 13+ with Xcode 15+
- OR Windows 10+ with VS 2019+
- Target devices: Argument Buffers Tier 2 (macOS 14+, iOS 17+)

**Workflow**:

```bash
# Step 1: Compile HLSL to DXIL using DXC
dxc -T vs_6_0 -E MainVS -Fo vertex.dxil shader.hlsl
dxc -T ps_6_0 -E MainPS -Fo fragment.dxil shader.hlsl

# Step 2: Convert DXIL to Metal library
metal-shaderconverter vertex.dxil -o vertex.metallib
metal-shaderconverter fragment.dxil -o fragment.metallib

# Step 3: Load in Swift
let vertexLib = try device.makeLibrary(URL: vertexURL)
let fragmentLib = try device.makeLibrary(URL: fragmentURL)
```

**Key Options**:

| Option | Purpose |
|--------|---------|
| `-o <file>` | Output metallib path |
| `--minimum-gpu-family` | Target GPU family |
| `--minimum-os-build-version` | Minimum OS version |
| `--vertex-stage-in` | Separate vertex fetch function |
| `-dualSourceBlending` | Enable dual-source blending |

**Supported Shader Models**: SM 6.0 - 6.6 (with limitations on 6.6 features)

## Part 3: OpenGL API to Metal API

### View/Context Setup

| OpenGL | Metal |
|--------|-------|
| `NSOpenGLView` | `MTKView` |
| `GLKView` | `MTKView` |
| `EAGLContext` | `MTLDevice` + `MTLCommandQueue` |
| `CGLContextObj` | `MTLDevice` |

### Resource Creation

| OpenGL | Metal |
|--------|-------|
| `glGenBuffers` + `glBufferData` | `device.makeBuffer(bytes:length:options:)` |
| `glGenTextures` + `glTexImage2D` | `device.makeTexture(descriptor:)` + `texture.replace(region:...)` |
| `glGenFramebuffers` | `MTLRenderPassDescriptor` |
| `glGenVertexArrays` | `MTLVertexDescriptor` |
| `glCreateShader` + `glCompileShader` | Build-time compilation → `MTLLibrary` |
| `glCreateProgram` + `glLinkProgram` | `MTLRenderPipelineDescriptor` → `MTLRenderPipelineState` |

### State Management

| OpenGL | Metal |
|--------|-------|
| `glEnable(GL_DEPTH_TEST)` | `MTLDepthStencilDescriptor` → `MTLDepthStencilState` |
| `glDepthFunc(GL_LESS)` | `descriptor.depthCompareFunction = .less` |
| `glEnable(GL_BLEND)` | `pipelineDescriptor.colorAttachments[0].isBlendingEnabled = true` |
| `glBlendFunc` | `sourceRGBBlendFactor`, `destinationRGBBlendFactor` |
| `glCullFace` | `encoder.setCullMode(.back)` |
| `glFrontFace` | `encoder.setFrontFacing(.counterClockwise)` |
| `glViewport` | `encoder.setViewport(MTLViewport(...))` |
| `glScissor` | `encoder.setScissorRect(MTLScissorRect(...))` |

### Draw Commands

| OpenGL | Metal |
|--------|-------|
| `glDrawArrays(mode, first, count)` | `encoder.drawPrimitives(type:vertexStart:vertexCount:)` |
| `glDrawElements(mode, count, type, indices)` | `encoder.drawIndexedPrimitives(type:indexCount:indexType:indexBuffer:indexBufferOffset:)` |
| `glDrawArraysInstanced` | `encoder.drawPrimitives(type:vertexStart:vertexCount:instanceCount:)` |
| `glDrawElementsInstanced` | `encoder.drawIndexedPrimitives(...instanceCount:)` |

### Primitive Types

| OpenGL | Metal |
|--------|-------|
| `GL_POINTS` | `.point` |
| `GL_LINES` | `.line` |
| `GL_LINE_STRIP` | `.lineStrip` |
| `GL_TRIANGLES` | `.triangle` |
| `GL_TRIANGLE_STRIP` | `.triangleStrip` |
| `GL_TRIANGLE_FAN` | N/A (decompose to triangles) |

## Part 4: Complete Setup Examples

### MTKView Setup (Recommended)

```swift
import MetalKit

class GameViewController: UIViewController {
    var metalView: MTKView!
    var renderer: Renderer!

    override func viewDidLoad() {
        super.viewDidLoad()

        // Create Metal view
        guard let device = MTLCreateSystemDefaultDevice() else {
            fatalError("Metal not supported")
        }

        metalView = MTKView(frame: view.bounds, device: device)
        metalView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        metalView.colorPixelFormat = .bgra8Unorm
        metalView.depthStencilPixelFormat = .depth32Float
        metalView.clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)
        metalView.preferredFramesPerSecond = 60
        view.addSubview(metalView)

        // Create renderer
        renderer = Renderer(metalView: metalView)
        metalView.delegate = renderer
    }
}

class Renderer: NSObject, MTKViewDelegate {
    let device: MTLDevice
    let commandQueue: MTLCommandQueue
    var pipelineState: MTLRenderPipelineState!
    var depthState: MTLDepthStencilState!
    var vertexBuffer: MTLBuffer!

    init(metalView: MTKView) {
        device = metalView.device!
        commandQueue = device.makeCommandQueue()!
        super.init()

        buildPipeline(metalView: metalView)
        buildDepthStencil()
        buildBuffers()
    }

    private func buildPipeline(metalView: MTKView) {
        let library = device.makeDefaultLibrary()!

        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = library.makeFunction(name: "vertexShader")
        descriptor.fragmentFunction = library.makeFunction(name: "fragmentShader")
        descriptor.colorAttachments[0].pixelFormat = metalView.colorPixelFormat
        descriptor.depthAttachmentPixelFormat = metalView.depthStencilPixelFormat

        // Vertex descriptor (matches shader's VertexIn struct)
        let vertexDescriptor = MTLVertexDescriptor()
        vertexDescriptor.attributes[0].format = .float3
        vertexDescriptor.attributes[0].offset = 0
        vertexDescriptor.attributes[0].bufferIndex = 0
        vertexDescriptor.attributes[1].format = .float2
        vertexDescriptor.attributes[1].offset = MemoryLayout<SIMD3<Float>>.stride
        vertexDescriptor.attributes[1].bufferIndex = 0
        vertexDescriptor.layouts[0].stride = MemoryLayout<Vertex>.stride
        descriptor.vertexDescriptor = vertexDescriptor

        pipelineState = try! device.makeRenderPipelineState(descriptor: descriptor)
    }

    private func buildDepthStencil() {
        let descriptor = MTLDepthStencilDescriptor()
        descriptor.depthCompareFunction = .less
        descriptor.isDepthWriteEnabled = true
        depthState = device.makeDepthStencilState(descriptor: descriptor)
    }

    func mtkView(_ view: MTKView, drawableSizeWillChange size: CGSize) {
        // Handle resize
    }

    func draw(in view: MTKView) {
        guard let drawable = view.currentDrawable,
              let descriptor = view.currentRenderPassDescriptor,
              let commandBuffer = commandQueue.makeCommandBuffer(),
              let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else {
            return
        }

        encoder.setRenderPipelineState(pipelineState)
        encoder.setDepthStencilState(depthState)
        encoder.setVertexBuffer(vertexBuffer, offset: 0, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: vertexCount)
        encoder.endEncoding()

        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
```

### CAMetalLayer Setup (Custom Control)

```swift
import Metal
import QuartzCore

class MetalLayerView: UIView {
    var metalLayer: CAMetalLayer!
    var device: MTLDevice!
    var commandQueue: MTLCommandQueue!
    var displayLink: CADisplayLink?

    override class var layerClass: AnyClass { CAMetalLayer.self }

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    private func setup() {
        device = MTLCreateSystemDefaultDevice()!
        commandQueue = device.makeCommandQueue()!

        metalLayer = layer as? CAMetalLayer
        metalLayer.device = device
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = true

        displayLink = CADisplayLink(target: self, selector: #selector(render))
        displayLink?.add(to: .main, forMode: .common)
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        metalLayer.drawableSize = CGSize(
            width: bounds.width * contentScaleFactor,
            height: bounds.height * contentScaleFactor
        )
    }

    @objc func render() {
        guard let drawable = metalLayer.nextDrawable(),
              let commandBuffer = commandQueue.makeCommandBuffer() else {
            return
        }

        let descriptor = MTLRenderPassDescriptor()
        descriptor.colorAttachments[0].texture = drawable.texture
        descriptor.colorAttachments[0].loadAction = .clear
        descriptor.colorAttachments[0].storeAction = .store
        descriptor.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0, blue: 0, alpha: 1)

        guard let encoder = commandBuffer.makeRenderCommandEncoder(descriptor: descriptor) else {
            return
        }

        // Draw commands here
        encoder.endEncoding()

        commandBuffer.present(drawable)
        commandBuffer.commit()
    }
}
```

### Compute Shader Setup

```swift
class ComputeProcessor {
    let device: MTLDevice
    let commandQueue: MTLCommandQueue
    var computePipeline: MTLComputePipelineState!

    init() {
        device = MTLCreateSystemDefaultDevice()!
        commandQueue = device.makeCommandQueue()!

        let library = device.makeDefaultLibrary()!
        let function = library.makeFunction(name: "computeKernel")!
        computePipeline = try! device.makeComputePipelineState(function: function)
    }

    func process(input: MTLBuffer, output: MTLBuffer, count: Int) {
        let commandBuffer = commandQueue.makeCommandBuffer()!
        let encoder = commandBuffer.makeComputeCommandEncoder()!

        encoder.setComputePipelineState(computePipeline)
        encoder.setBuffer(input, offset: 0, index: 0)
        encoder.setBuffer(output, offset: 0, index: 1)

        let threadGroupSize = MTLSize(width: 256, height: 1, depth: 1)
        let threadGroups = MTLSize(
            width: (count + 255) / 256,
            height: 1,
            depth: 1
        )

        encoder.dispatchThreadgroups(threadGroups, threadsPerThreadgroup: threadGroupSize)
        encoder.endEncoding()

        commandBuffer.commit()
        commandBuffer.waitUntilCompleted()
    }
}
```

```metal
// Compute shader
kernel void computeKernel(
    device float* input [[buffer(0)]],
    device float* output [[buffer(1)]],
    uint id [[thread_position_in_grid]]
) {
    output[id] = input[id] * 2.0;
}
```

## Part 5: Storage Modes & Synchronization

### Buffer Storage Modes

| Mode | CPU Access | GPU Access | Use Case |
|------|------------|------------|----------|
| `.shared` | Read/Write | Read/Write | Small dynamic data, uniforms |
| `.private` | None | Read/Write | Static assets, render targets |
| `.managed` (macOS) | Read/Write | Read/Write | Large buffers with partial updates |

```swift
// Shared: CPU and GPU both access (iOS typical)
let uniformBuffer = device.makeBuffer(length: size, options: .storageModeShared)

// Private: GPU only (best for static geometry)
let vertexBuffer = device.makeBuffer(bytes: vertices, length: size, options: .storageModePrivate)

// Managed: Explicit sync (macOS)
#if os(macOS)
let buffer = device.makeBuffer(length: size, options: .storageModeManaged)
// After CPU write:
buffer.didModifyRange(0..<size)
#endif
```

### Texture Storage Modes

```swift
let descriptor = MTLTextureDescriptor.texture2DDescriptor(
    pixelFormat: .rgba8Unorm,
    width: 1024,
    height: 1024,
    mipmapped: true
)

// For static textures (loaded once)
descriptor.storageMode = .private
descriptor.usage = [.shaderRead]

// For render targets
descriptor.storageMode = .private
descriptor.usage = [.renderTarget, .shaderRead]

// For CPU-readable (screenshots, readback)
descriptor.storageMode = .shared  // iOS
descriptor.storageMode = .managed  // macOS
descriptor.usage = [.shaderRead, .shaderWrite]
```

## Resources

**WWDC**: 2016-00602, 2018-00604, 2019-00611

**Docs**: /metal/migrating-opengl-code-to-metal, /metal/shader-converter, /metalkit/mtkview

**Skills**: axiom-metal-migration, axiom-metal-migration-diag

---

**Last Updated**: 2025-12-29
**Platforms**: iOS 12+, macOS 10.14+, tvOS 12+
**Status**: Complete shader conversion and API mapping reference
