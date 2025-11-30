const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying FHENftCollection with:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance (wei):", balance.toString());

  const FHENftCollection = await hre.ethers.getContractFactory("FHENftCollection");
  const collection = await FHENftCollection.deploy();
  await collection.waitForDeployment();

  const address = await collection.getAddress();
  console.log("FHENftCollection deployed to:", address);

  const artifact = await hre.artifacts.readArtifact("FHENftCollection");

  // Adjusted for: pred3/contract (this script) and pred3/frontend
  const frontendContractsDir = path.join(
    __dirname,
    "..",
    "..",
    "frontend",
    "src",
    "contracts"
  );

  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }

  // Address file
  fs.writeFileSync(
    path.join(frontendContractsDir, "FHENftCollection-address.json"),
    JSON.stringify({ address }, null, 2),
    "utf8"
  );

  // ABI file
  fs.writeFileSync(
    path.join(frontendContractsDir, "FHENftCollection-abi.json"),
    JSON.stringify(artifact.abi, null, 2),
    "utf8"
  );

  console.log("✅ FHENftCollection ABI & address written to frontend/src/contracts");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
