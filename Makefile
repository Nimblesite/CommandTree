.PHONY: format lint build package test

format:
	npx prettier --write "src/**/*.ts"

lint:
	npx eslint src

build:
	npx tsc -p ./

package: build
	npx vsce package

test: build
	npm run test:unit
	npx vscode-test --coverage
