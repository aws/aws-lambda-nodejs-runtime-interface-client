{
    'targets': [
        {
            'target_name': 'runtime-client',
            'sources': [
                'lib/RuntimeClient/runtime-client.cc',
            ],
            'dependencies': [
                "<!(node -p \"require('node-addon-api').gyp\")",
            ],
            'include_dirs' : [
                "<!@(node -p \"require('node-addon-api').include\")",
                "deps/artifacts/include",
            ],
            'link_settings' : {
                'library_dirs': [
                    '<!(pwd)/deps/artifacts/lib/',
                    '<!(pwd)/deps/artifacts/lib64/',
                ],
            },
            'libraries': [
                '-laws-lambda-runtime',
                '<!@(deps/artifacts/bin/curl-config --static-libs)',
            ],
            'cflags': [ '-fPIC' ],
            'cflags_cc': [ '-fPIC' ],
            'ldflags': [ '-fvisibility=hidden' ],
            'cflags!': [ '-fno-exceptions' ],
            'cflags_cc!': [ '-fno-exceptions' ],
            'xcode_settings': {
              'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
              'CLANG_CXX_LIBRARY': 'libc++',
              'MACOSX_DEPLOYMENT_TARGET': '10.7',
            },
            'msvs_settings': {
              'VCCLCompilerTool': { 'ExceptionHandling': 1 },
            },
        }
    ]
}
