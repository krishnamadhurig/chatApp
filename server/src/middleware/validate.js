const {validationResult}=require('express-validator');
const { json } = require('sequelize');

const validate=(req,res,next)=>{
    const result=validationResult(req);
    if(result.isEmpty()) return next();
    res.status(400).json({success:false, error:result.array()[0].mdg});
};

module.exports=validate