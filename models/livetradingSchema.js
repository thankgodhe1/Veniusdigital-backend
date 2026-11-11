const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user_id:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  trading_asset_id:{type:mongoose.Schema.Types.ObjectId,ref:'TradingAsset'},
  asset_type:{type:String,default:'Crypto'},asset_name:{type:String,default:''},action:{type:String,default:'BUY'},
  amount:{type:Number,default:0},leverage:{type:Number,default:1},duration:{type:Number,default:0},entry_price:{type:Number,default:0},
  status:{type:String,enum:['open','closed','cancelled'],default:'open',index:true},result:{type:String,default:''},profit_loss:{type:Number,default:0},settled_by:{type:String,default:''},opened:{type:Date,default:Date.now},settled_at:Date
},{timestamps:true});
module.exports=mongoose.models.Trade || mongoose.model('Trade',schema);
