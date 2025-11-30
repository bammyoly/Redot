// scripts/deploy.js
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("Balance (wei):", balance.toString());

  const FHENftAuction = await hre.ethers.getContractFactory("FHENftAuction");
  const auction = await FHENftAuction.deploy();
  await auction.waitForDeployment();

  const auctionAddress = await auction.getAddress();
  console.log("FHENftAuction deployed to:", auctionAddress);

  const auctionArtifact = await hre.artifacts.readArtifact("FHENftAuction");

  const FHENftCollection = await hre.ethers.getContractFactory("FHENftCollection");
  const collection = await FHENftCollection.deploy();
  await collection.waitForDeployment();

  const collectionAddress = await collection.getAddress();
  console.log("FHENftCollection deployed to:", collectionAddress);

  const collectionArtifact = await hre.artifacts.readArtifact("FHENftCollection");

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

  const auctionAddressFile = path.join(
    frontendContractsDir,
    "FHENftAuction-address.json"
  );
  fs.writeFileSync(
    auctionAddressFile,
    JSON.stringify({ address: auctionAddress }, null, 2),
    "utf8"
  );

  const auctionAbiFile = path.join(
    frontendContractsDir,
    "FHENftAuction-abi.json"
  );
  fs.writeFileSync(
    auctionAbiFile,
    JSON.stringify(auctionArtifact.abi, null, 2),
    "utf8"
  );

  const collectionAddressFile = path.join(
    frontendContractsDir,
    "FHENftCollection-address.json"
  );
  fs.writeFileSync(
    collectionAddressFile,
    JSON.stringify({ address: collectionAddress }, null, 2),
    "utf8"
  );

  const collectionAbiFile = path.join(
    frontendContractsDir,
    "FHENftCollection-abi.json"
  );
  fs.writeFileSync(
    collectionAbiFile,
    JSON.stringify(collectionArtifact.abi, null, 2),
    "utf8"
  );

  console.log("✅ ABIs and addresses written to frontend/src/contracts");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
