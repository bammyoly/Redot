import React from 'react';
import HeroImageThumb from '../assets/Hero_thumb.png';

const Hero = () => {
  return (
    <section className="bg-[#050505] text-white overflow-hidden relative min-h-screen flex items-center">
      
      <div className="container mx-auto px-10 mt-15 md:px-24 lg:px-40 py-16 md:py-24 flex flex-col lg:flex-row 
      items-center gap-12 lg:gap-24">
        
        <div className="flex-1 flex flex-col items-start space-y-8 z-10 text-left">
          <span className="text-fuchsia-500 font-bold tracking-wider uppercase text-sm md:text-base">
            Access top bids from popular NFTs
          </span>

          <h1 className="text-4xl md:text-5xl lg:text-7xl font-extrabold leading-tight">
            Explore Private Bids on Popular NFTs
          </h1>

          <p className="text-gray-400 text-lg md:text-xl max-w-lg leading-relaxed">
            Bd on popular NFTs and purchase nfts at unbeatable prices. All bids are private and 
            protected with ZAMA FHE Encryption
          </p>

          <div className="relative group pt-4">
            <button className="relative z-10 bg-black text-white border border-fuchsia-900 
            px-10 py-4 font-bold tracking-wide rounded-sm transition-transform group-hover:-translate-y-1">
              Request Access
            </button>
            
            <div className="absolute inset-0 mt-6 mx-4 h-full bg-fuchsia-700 blur-2xl opacity-40 
            group-hover:opacity-60 transition-opacity duration-300 -z-10"></div>
          </div>
        </div>

        <div className="flex-1 relative z-10 flex justify-center lg:justify-end mt-8 lg:mt-0">
          <img 
            src={HeroImageThumb} 
            alt="Exclusive NFT collectors experience" 
            className="w-full max-w-md lg:max-w-full h-auto object-contain"
          />
        </div>
      </div>
    </section>
  );
};

export default Hero;