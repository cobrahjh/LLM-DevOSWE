{
  "targets": [
    {
      "target_name": "screen_capture",
      "sources": ["capture.cpp"],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "libraries": [
        "d3d11.lib",
        "dxgi.lib"
      ],
      "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS"],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/EHsc"]
        }
      }
    }
  ]
}
