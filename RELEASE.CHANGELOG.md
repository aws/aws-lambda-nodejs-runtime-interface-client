### May 21, 2025
`3.3.0`
- Add support for multi tenancy ([#128](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/128))

### Aug 26, 2024
`3.2.1`
- Update test dependencies ([#115](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/115))
- Fix autoconf build issue ([#117](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/117))

### Jul 03, 2024
`3.2.0`
- Introduce advanced logging controls ([#91](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/91))
- Bump package-lock deps ([#98](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/98))
- Remove Node14 from integ tests matrix since it is deprecated ([#99](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/99))
- Bump tar from 6.1.15 to 6.2.1 ([#103](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/103))
- Handle invalid char when sending HTTP request to Runtime API ([#100](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/100))
- Bump braces from 3.0.2 to 3.0.3 ([#109](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/109))
- Update codebuild_build.sh script ([#110](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/110))
- Fix centos and ubuntu integ tests ([#111](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/111))
- Encode request id in URI path ([#113](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/113))
- Release aws-lambda-ric 3.2.0 ([#114](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/114))

### Nov 09, 2023
`3.1.0`
- tar using --no-same-owner by @JavaScriptBach ([#46](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/46))
- Use python3.8 in al2 integ tests ([#72](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/72))
- Create pull request template ([#73](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/73))
- Bump deps ([#79](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/79))
- Remove unrecognized --disable-websockets option ([#80](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/80))
- Update Distros and integration tests ([#82](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/82))
- Clean up images after running integ tests ([#84](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/84))
- Add Alpine3.17,3.18 remove 3.15 for integ tests ([#85](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/85))
- Bump @babel/traverse from 7.22.5 to 7.23.2 ([#86](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/86))
- Add Node20 to the test matrix ([#87](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/87))
- Release aws-lambda-ric 3.1.0 ([#88](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/88))

### Jun 26, 2023
`3.0.0`
- AWS Lambda response streaming support
- ES module support
- Migrate from TypeScript to JavaScript, Include type declaration files for TypeScript support.
- Support Amazon Linux 2023
- Update RIE to v1.12
- Reduce image size by deleting aws-lambda-cpp and curl dependencies after building them
- aws-lambda-ric 3.0.0 release ([#70](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/70))
- Run integration tests against every distro on PR ([#71](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/71))


### May 15, 2023
`2.1.0`
- Allow passing HandlerFunction to run function directly ([#20](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/20))
- Update dependencies: tar and ansi-regex ([#38](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/38))
- Bump minimist from 1.2.5 to 1.2.6 ([#48](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/48))
- Update Curl to 7.83.0 ([#49](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/49))
- Update Curl to 7.84.0 ([#52](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/52))
- update aws-lambda-cpp ([#57](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/57))
- Bump minimatch and mocha ([#58](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/58))
- Update dependencies and distros ([#65](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/65))
- Revert libcurl 7.84.0 update ([#66](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/66))
- Stage aws-lambda-ric 2.1.0 release ([#67](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/67))

### Sep 29, 2021
`2.0.0`
- AWS Lambda Runtime Interface Client for NodeJS with ARM64 support

### Jun 09, 2021
`1.1.0`
- Update Curl version to 7.77.0 ([#23](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/23))
- Update dependencies, remove unused dependencies, add prettier plugin to eslint ([#19](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/19))
- Fix errors issues
- Remove trailing . from sample curl command
- Add `docker login` to fix pull rate limit issue ([#2](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/2))
- Include GitHub action on push and pr ([#1](https://github.com/aws/aws-lambda-nodejs-runtime-interface-client/pull/1))

### Dec 01, 2020
`1.0.0`
- Initial release of AWS Lambda Runtime Interface Client for NodeJS

