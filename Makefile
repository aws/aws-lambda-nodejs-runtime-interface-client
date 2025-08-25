target:
	$(info ${HELP_MESSAGE})
	@exit 0

init:
	npm install

test:
	npm run test

copy-files:
	npm run copy-files

install:
	BUILD=$(BUILD) npm install

format:
	npm run format

# Command to run everytime you make changes to verify everything works
dev: init test

# Verifications to run before sending a pull request
pr: build dev

clean:
	npm run clean

build: copy-files
	make install BUILD=1
	npm run build

pack: build
	npm pack

.PHONY: target init test install format dev pr clean build pack copy-files

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
