const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  title:{type:String,required:true},message:{type:String,default:''},type:{type:String,default:'info'},icon:{type:String,default:'bell'},link:{type:String,default:'/user/notification.html'},meta:{type:mongoose.Schema.Types.Mixed,default:{}},read_at:{type:Date,default:null}
},{timestamps:true});
schema.index({user:1,createdAt:-1});
module.exports=mongoose.models.LegacyNotification||mongoose.model('LegacyNotification',schema);
