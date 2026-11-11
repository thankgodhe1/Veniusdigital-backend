const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  user_id:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  type:{type:String,default:'account',index:true},title:{type:String,required:true},message:{type:String,default:''},icon:{type:String,default:'bell'},action_url:{type:String,default:null},data:{type:mongoose.Schema.Types.Mixed,default:{}},read_at:{type:Date,default:null,index:true}
},{timestamps:true});
schema.index({user_id:1,createdAt:-1});
module.exports=mongoose.models.Notification||mongoose.model('Notification',schema);
