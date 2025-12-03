build:
	npm install
	npm run build

test:
	npm test

integ:
	npm run test:integ

lint:
	npm run lint:fix

container:
	npm run build:container

.PHONY: build test integ lint container
