import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-[#1a1a1a] text-gray-300 border-t border-fuchsia-900/50 py-12 md:py-16">
      
      <div className="container mx-auto px-10 md:px-24 lg:px-40">
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 border-b border-gray-700 pb-10 mb-10">
          
          <div className="col-span-2 md:col-span-2 space-y-4">
            <span className="bg-gradient-to-r lg:text-3xl from-fuchsia-400 via-purple-400 to-sky-400 bg-clip-text text-transparent">
              REDOT
            </span>
            <p className="text-sm max-w-xs">
              THe First Blockchain Most Secured Private Bidding Platform For Digital Arts & Collectibles.
            </p>
          </div>
          
          <div className="col-span-1">
            <h4 className="font-bold text-white uppercase mb-4 text-sm tracking-wider">Platform</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Private Auctions</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Our Process</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Vetting Standards</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Membership</a></li>
            </ul>
          </div>
          
          <div className="col-span-1">
            <h4 className="font-bold text-white uppercase mb-4 text-sm tracking-wider">Support</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">FAQ</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Contact Us</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Wallet Setup Guide</a></li>
            </ul>
          </div>

          <div className="col-span-1">
            <h4 className="font-bold text-white uppercase mb-4 text-sm tracking-wider">Legal</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-fuchsia-500 transition-colors">Auction Rules</a></li>
            </ul>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} AURA Collective. All Rights Reserved.</p>
          
          <div className="flex space-x-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-fuchsia-500 transition-colors">Discord</a>
            <a href="#" className="hover:text-fuchsia-500 transition-colors">X (Twitter)</a>
            <a href="#" className="hover:text-fuchsia-500 transition-colors">Medium</a>
          </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;