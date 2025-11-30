import React from 'react';
import HeroImageThumb from '../assets/hero_thumb.png';
import { Link } from 'react-router-dom'

const Home = () => {
  return (
    <div className="bg-[#050505] text-white font-sans">
      
      <section className="relative min-h-screen flex items-center overflow-hidden">
        <div className="container mx-auto px-10 md:px-24 lg:px-40 py-16 md:py-24 flex flex-col 
        lg:flex-row items-center gap-12 lg:gap-24">
          
          <div className="flex-1 flex flex-col items-start space-y-8 z-10 text-left">
            <span className="text-fuchsia-500 mt-10 font-bold tracking-wider uppercase text-sm md:text-base">
              Access top bids from popular NFTs
            </span>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
              Explore Private Bids on Popular NFTs
            </h1>

            <p className="text-gray-400 text-lg md:text-xl max-w-lg leading-relaxed">
            Bid on popular NFTs and purchase nfts at unbeatable prices. All bids are private and 
            protected with ZAMA FHE Encryption</p>

            <div className="relative group pt-4">
              <Link to='/auctions'>
                <button className="relative z-10 bg-black text-white border border-fuchsia-900 px-10 py-4 
                font-bold tracking-wide rounded-sm hover:bg-fuchsia-900/20 transition-all cursor-pointer">
                  Start Bidding
                </button>
              </Link>
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

      <section className="py-24 md:py-36 border-t border-b border-gray-900/50">
        <div className="container mx-auto px-10 md:px-24 lg:px-40">
          <h2 className="text-3xl md:text-5xl font-extrabold mb-16 text-center max-w-4xl mx-auto">
            Auction Your NFTs and Get the best Value in Just Three Steps
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            
            <div className="p-6 bg-[#0c0c0c] border border-fuchsia-900/30 rounded-lg shadow-2xl 
            transition-transform hover:scale-[1.02]">
              <div className="text-fuchsia-400 text-3xl mb-4">📋</div>
              <h3 className="text-xl font-bold mb-3">List NFT(s) available in your portfolio</h3>
              <p className="text-gray-400">You can list both popular and new NFTs in your portfolio for auction</p>
            </div>
            
            <div className="p-6 bg-[#0c0c0c] border border-fuchsia-900/30 rounded-lg shadow-2xl 
            transition-transform hover:scale-[1.02]">
              <div className="text-fuchsia-400 text-3xl mb-4">💲</div>
              <h3 className="text-xl font-bold mb-3">Set a Minimum Bid Price</h3>
              <p className="text-gray-400">Set the lowest price buyers can bid to purchase your NFT(s) as well as 
                timeframe for the auction</p>
            </div>
            
            <div className="p-6 bg-[#0c0c0c] border border-fuchsia-900/30 rounded-lg shadow-2xl 
            transition-transform hover:scale-[1.02]">
              <div className="text-fuchsia-400 text-3xl mb-4">🏅</div>
              <h3 className="text-xl font-bold mb-3">Highest Bidder Wins</h3>
              <p className="text-gray-400">At the end of the set auction time, the highest bid for your NFT wins the sale.</p>
            </div>

          </div>
        </div>
      </section>

      <section className="bg-[#0c0c0c] py-20 border-t border-fuchsia-900/50">
        <div className="container mx-auto px-10 md:px-24 lg:px-40 text-center">
          <p className="text-fuchsia-500 font-bold uppercase tracking-widest mb-4">Become an Elite Collector</p>
          <h2 className="text-4xl md:text-5xl font-extrabold mb-8 max-w-3xl mx-auto">
            Get The Best Value For Your Digital Collectibles!
          </h2>
          <p className="text-gray-400 text-xl mb-10 max-w-2xl mx-auto">
            NFTs Are Dead?? Here is an opportunity to claim the best value for your digital arts and 
            collectibles from our fully secure, private auction
          </p>
          
          <div className="relative group inline-block">
            <Link to='/auctions'>
              <button className="relative z-10 bg-fuchsia-600 text-white font-bold px-12 py-4 rounded-sm shadow-lg 
              shadow-fuchsia-600/30 hover:bg-fuchsia-700 transition-all">
                Explore Auctions
              </button>
            </Link>
            <div className="absolute inset-0 mt-6 mx-4 h-full bg-fuchsia-900 blur-2xl opacity-50 transition-opacity
             duration-300 -z-10"></div>
          </div>
        </div>
      </section>

    </div>
  );
};

export default Home;