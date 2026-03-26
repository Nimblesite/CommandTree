.PHONY: format lint build package test test-exclude-ci ci

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

test-exclude-ci: build
	npm run test:unit
	npx vscode-test --coverage --grep @exclude-ci --invert

ci: format lint build test package
