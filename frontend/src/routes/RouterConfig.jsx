import { Routes, Route } from 'react-router-dom'
import Home from '../pages/Home'
import CreateNft from '../pages/CreateNft'
import CreateNftAuction from '../pages/CreateNftAuction'
import NftAuctions from '../pages/NftAuctions'
import MyAuctions from '../pages/MyAuctions'
import MyNfts from '../pages/MyNfts'
import ClaimCenter from '../pages/ClaimCenter'

const RouterConfig = () => {
  return (
    <div>
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/auctions' element={<NftAuctions />} />
        <Route path='/auction/create' element={<CreateNftAuction />} />
        <Route path='/nft/create' element={<CreateNft />} />
        <Route path='/myauctions' element={<MyAuctions />} />
        <Route path='/mynfts' element={<MyNfts />} />
        <Route path='/claim-center' element={<ClaimCenter />} />
      </Routes>
    </div>
  )
}

export default RouterConfig
