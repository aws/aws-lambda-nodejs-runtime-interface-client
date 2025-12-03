{
    'targets': [
        {
            'variables': {
                'deps_prefix': '<!(echo ${DEPS_PREFIX:-"$(pwd)/deps"})'
            },
            'target_name': 'rapid-client',
            'sources': [
                'rapid-client.cc',
            ],
            'dependencies': [
                "<!(node -p \"require('node-addon-api').gyp\")",
            ],
            'include_dirs': [
                "<!@(node -p \"require('node-addon-api').include\")",
                "<(deps_prefix)/include",
            ],
            'libraries': [
                '<(deps_prefix)/lib/libaws-lambda-runtime.a',
                '<(deps_prefix)/lib/libcurl.a -pthread',
            ],
            'cflags': ['-fPIC', '-O3', '-flto'],
            'cflags_cc': ['-fPIC', '-O3', '-flto'],
            'ldflags': ['-fvisibility=hidden', '-Wl,--gc-sections', '-Wl,--print-gc-sections'],
            'cflags!': ['-fno-exceptions'],
            'cflags_cc!': ['-fno-exceptions'],
            'xcode_settings': {
                'GCC_ENABLE_CPP_EXCEPTIONS': 'YES',
                'CLANG_CXX_LIBRARY': 'libc++',
                'MACOSX_DEPLOYMENT_TARGET': '10.7',
            },
            'msvs_settings': {
                'VCCLCompilerTool': {'ExceptionHandling': 1},
            },
        }
    ]
}
