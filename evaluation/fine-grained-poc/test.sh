#!/bin/bash

# Configuration paths (adjust these to your actual NodeShield CLI path)
NODESHIELD_CLI="../../../src/cli.js"
VICTIM_DIR="./app"
POC_TYPE="${1:-fs}"
PKGS_DIR="./pkgs/${POC_TYPE}"

TARBALL_NAME="poc-pkg-1.0.0.tgz"

cleanup() {
    # Remove tarball
    rm -f "./pkgs/${TARBALL_NAME}"

    # Remove victim app generated files
    rm -f "${VICTIM_DIR}/sbom.json"
    rm -f "${VICTIM_DIR}/cbom.json"
    rm -rf "${VICTIM_DIR}/node_modules"
    rm -f "${VICTIM_DIR}/package-lock.json"
    for type in "fs" "network"; do
        rm -f "./pkgs/${type}/benign/${TARBALL_NAME}"
        rm -f "./pkgs/${type}/evil/${TARBALL_NAME}"
    done


}

if [ "${POC_TYPE}" != "fs" ] && [ "${POC_TYPE}" != "network" ] && [ "${POC_TYPE}" != "clean" ]; then
    echo "Usage: $0 [fs|network]|clean]"
    exit 1
fi

cleanup
if [ "${POC_TYPE}" == "clean" ]; then
    exit 0
fi

pushd $PKGS_DIR/benign > /dev/null
npm pack --quiet > /dev/null
cp $TARBALL_NAME ../../${TARBALL_NAME} > /dev/null

popd > /dev/null
pushd $VICTIM_DIR > /dev/null

npm install --quiet > /dev/null
npm sbom --sbom-format cyclonedx > sbom.json

echo "=== Running NodeShield CLI on benign package to generate CBOM ==="
node $NODESHIELD_CLI \
    --sbom 'sbom.json' \
    --cbom-output 'cbom.json' \
    -- index.js

echo -e "\n\n"

popd > /dev/null
pushd $PKGS_DIR/evil > /dev/null

npm pack --quiet > /dev/null
cp $TARBALL_NAME ../../${TARBALL_NAME} > /dev/null

popd > /dev/null
pushd $VICTIM_DIR > /dev/null

npm update --quiet > /dev/null


echo "=== Running NodeShield CLI after the update with the same CBOM ==="
node $NODESHIELD_CLI \
    --sbom 'sbom.json' \
    --cbom 'cbom.json' \
    -- index.js