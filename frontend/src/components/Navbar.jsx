import React, { useEffect, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { assets } from "../assets/assets";
import { Link, useLocation } from "react-router-dom";
import { useAccount } from "wagmi";

const navLinks = [
  { name: "Home", path: "/" },
  { name: "Auctions", path: "/auctions" },
  { name: "Create Auction", path: "/auction/create" },
  { name: "Mint NFT", path: "/nft/create" },
  // My Auctions / My NFTs moved under Dashboard
];

const Navbar = () => {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const location = useLocation();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (showMobileMenu) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [showMobileMenu]);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="fixed top-0 left-0 w-full z-30">
      <div className="bg-black/40 backdrop-blur-md border-b border-fuchsia-900/40">
        <div className="container mx-auto flex justify-between items-center py-4 px-6 md:px-12 lg:px-20">
          {/* Logo */}
          <Link
            to="/"
            className="text-2xl font-extrabold tracking-tight text-white"
          >
            <span className="bg-gradient-to-r from-fuchsia-400 via-purple-400 to-sky-400 bg-clip-text text-transparent">
              REDOT
            </span>
          </Link>

          {/* Desktop nav */}
          <ul className="hidden md:flex gap-7 lg:gap-10 items-center text-sm">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`cursor-pointer transition-colors duration-200 font-medium ${
                  isActive(link.path)
                    ? "text-fuchsia-300"
                    : "text-gray-300 hover:text-fuchsia-400"
                }`}
              >
                {link.name}
              </Link>
            ))}

            {/* Dashboard dropdown (only when wallet is connected) */}
            {isConnected && (
              <li className="relative group">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 cursor-pointer transition-colors duration-200 font-medium text-gray-300 hover:text-fuchsia-400"
                >
                  Dashboard
                  <span className="text-xs">▾</span>
                </button>

                {/* Dropdown menu – fixed hover behaviour */}
                <div
                  className="
                    absolute right-0 mt-2 w-52 rounded-lg bg-black/90
                    border border-fuchsia-900/40 shadow-xl shadow-fuchsia-900/30
                    opacity-0 translate-y-1 invisible
                    group-hover:opacity-100 group-hover:translate-y-0 group-hover:visible
                    transition-all duration-150
                  "
                >
                  <div className="py-2 text-xs text-gray-300">
                    <Link
                      to="/mynfts"
                      className={`block px-4 py-2 hover:bg-fuchsia-950/60 hover:text-fuchsia-200 ${
                        isActive("/mynfts") ? "text-fuchsia-300" : ""
                      }`}
                    >
                      My NFTs
                    </Link>
                    <Link
                      to="/myauctions"
                      className={`block px-4 py-2 hover:bg-fuchsia-950/60 hover:text-fuchsia-200 ${
                        isActive("/myauctions") ? "text-fuchsia-300" : ""
                      }`}
                    >
                      My Auctions
                    </Link>
                    <Link
                      to="/claim-center"
                      className={`block px-4 py-2 hover:bg-fuchsia-950/60 hover:text-fuchsia-200 ${
                        isActive("/claim-center") ? "text-fuchsia-300" : ""
                      }`}
                    >
                      Claim Center
                    </Link>
                  </div>
                </div>
              </li>
            )}
          </ul>

          {/* Right section: Connect + mobile icon */}
          <div className="flex items-center space-x-4">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                mounted,
              }) => {
                const ready = mounted;
                const connected = ready && account && chain;

                return (
                  <div
                    {...(!ready && {
                      "aria-hidden": true,
                      style: {
                        opacity: 0,
                        pointerEvents: "none",
                        userSelect: "none",
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            type="button"
                            className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white 
                            font-semibold text-sm shadow-lg shadow-purple-900/30 transition-colors duration-200"
                          >
                            Connect Wallet
                          </button>
                        );
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            type="button"
                            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white 
                            font-semibold text-sm shadow-lg transition-colors duration-200"
                          >
                            Wrong network
                          </button>
                        );
                      }

                      return (
                        <div style={{ display: "flex", gap: 12 }}>
                          {/* Chain button */}
                          <button
                            onClick={openChainModal}
                            type="button"
                            className="px-3 py-2 rounded-lg bg-[#111827] hover:bg-[#1f2937] text-white 
                            font-medium text-xs shadow-md transition-colors duration-200 flex items-center"
                          >
                            {chain.hasIcon && (
                              <div
                                style={{
                                  background: chain.iconBackground,
                                  width: 14,
                                  height: 14,
                                  borderRadius: 999,
                                  overflow: "hidden",
                                  marginRight: 6,
                                }}
                              >
                                {chain.iconUrl && (
                                  <img
                                    alt={chain.name ?? "Chain icon"}
                                    src={chain.iconUrl}
                                    style={{ width: 14, height: 14 }}
                                  />
                                )}
                              </div>
                            )}
                            <span className="truncate max-w-[90px]">
                              {chain.name}
                            </span>
                          </button>

                          {/* Account button */}
                          <button
                            onClick={openAccountModal}
                            type="button"
                            className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white 
                            font-semibold text-xs shadow-lg shadow-purple-900/40 transition-colors duration-200"
                          >
                            {account.displayName}
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                );
              }}
            </ConnectButton.Custom>

            {/* Mobile Menu Icon */}
            <img
              onClick={() => setShowMobileMenu(true)}
              src={assets.menu_icon}
              className="w-7 cursor-pointer md:hidden"
              alt="Menu"
            />
          </div>

          {/* Mobile Menu Overlay */}
          <div
            className={`fixed top-0 right-0 h-full w-full md:hidden bg-black/90 backdrop-blur-md 
              transition-transform duration-300 ease-in-out transform ${
                showMobileMenu ? "translate-x-0" : "translate-x-full"
              } z-50`}
          >
            <div className="flex justify-end p-6">
              <img
                onClick={() => setShowMobileMenu(false)}
                src={assets.cross_icon}
                className="w-6 cursor-pointer"
                alt="Close"
              />
            </div>

            <ul className="flex flex-col items-center gap-6 mt-4 text-lg font-medium">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  to={link.path}
                  onClick={() => setShowMobileMenu(false)}
                  className={`px-3 py-2 rounded-md transition-colors duration-200 ${
                    isActive(link.path)
                      ? "text-fuchsia-300"
                      : "text-gray-200 hover:text-fuchsia-400"
                  }`}
                >
                  {link.name}
                </Link>
              ))}

              {/* Mobile Dashboard section (only when connected) */}
              {isConnected && (
                <div className="w-full px-6 mt-4 border-t border-fuchsia-900/40 pt-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500 mb-2 text-left">
                    Dashboard
                  </p>
                  <div className="flex flex-col items-start gap-2 text-base">
                    <Link
                      to="/mynfts"
                      onClick={() => setShowMobileMenu(false)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 ${
                        isActive("/mynfts")
                          ? "text-fuchsia-300"
                          : "text-gray-200 hover:text-fuchsia-400"
                      }`}
                    >
                      My NFTs
                    </Link>
                    <Link
                      to="/myauctions"
                      onClick={() => setShowMobileMenu(false)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 ${
                        isActive("/myauctions")
                          ? "text-fuchsia-300"
                          : "text-gray-200 hover:text-fuchsia-400"
                      }`}
                    >
                      My Auctions
                    </Link>
                    <Link
                      to="/claim-center"
                      onClick={() => setShowMobileMenu(false)}
                      className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 ${
                        isActive("/claim-center")
                          ? "text-fuchsia-300"
                          : "text-gray-200 hover:text-fuchsia-400"
                      }`}
                    >
                      Claim Center
                    </Link>
                  </div>
                </div>
              )}
            </ul>

            <div className="mt-8 flex justify-center pb-10">
              <ConnectButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
