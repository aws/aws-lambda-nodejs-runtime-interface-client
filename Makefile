target:
	$(info ${HELP_MESSAGE})
	@exit 0

init:
	npm install

test:
	npm run test

setup-codebuild-agent:
	docker build -t codebuild-agent - < test/integration/codebuild-local/Dockerfile.agent

test-smoke: setup-codebuild-agent
	CODEBUILD_IMAGE_TAG=codebuild-agent test/integration/codebuild-local/test_one.sh test/integration/codebuild/buildspec.os.alpine.1.yml alpine 3.16 18

test-integ: setup-codebuild-agent
	CODEBUILD_IMAGE_TAG=codebuild-agent test/integration/codebuild-local/test_all.sh test/integration/codebuild

copy-files:
	npm run copy-files

install:
	BUILD=$(BUILD) npm install

format:
	npm run format

# Command to run everytime you make changes to verify everything works
dev: init test

# Verifications to run before sending a pull request
pr: build dev test-smoke

clean:
	npm run clean

build: copy-files
	make install BUILD=1
	npm run build

pack: build
	npm pack

.PHONY: target init test setup-codebuild-agent test-smoke test-integ install format dev pr clean build pack copy-files

define HELP_MESSAGE

Usage: $ make [TARGETS]

TARGETS
	format      Run format to automatically update your code to match our formatting.
	build       Builds the package.
	clean       Cleans the working directory by removing built artifacts.
	dev         Run all development tests after a change.
	init        Initialize and install the dependencies and dev-dependencies for this project.
	pr          Perform all checks before submitting a Pull Request.
	test        Run the Unit tests.

endef
