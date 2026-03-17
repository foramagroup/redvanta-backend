import prisma from "../../config/database.js";

export const getPaymentGateways = async (req,res)=>{

 try{

  const gateways = await prisma.paymentGateway.findMany({
   orderBy:{provider:"asc"}
  })

  res.json(gateways)

 }catch(e){
  res.status(500).json({message:e.message})
 }

}

export const createGateway = async (req,res)=>{

 try{

  const {provider,apiKey,secretKey,webhookSecret,mode,isDefault} = req.body

  const gateway = await prisma.paymentGateway.create({

   data:{
    provider,
    apiKey,
    secretKey,
    webhookSecret,
    mode,
    isDefault
   }

  })

  res.json(gateway)

 }catch(e){
  res.status(500).json({message:e.message})
 }

}


export const updateGateway = async (req,res)=>{

 try{

  const {id} = req.params

  const gateway = await prisma.paymentGateway.update({

   where:{id:Number(id)},

   data:req.body

  })

  res.json(gateway)

 }catch(e){
  res.status(500).json({message:e.message})
 }

}


export const deleteGateway = async (req,res)=>{

 try{

  const {id} = req.params

  await prisma.paymentGateway.delete({
   where:{id:Number(id)}
  })

  res.json({message:"Gateway deleted"})

 }catch(e){
  res.status(500).json({message:e.message})
 }

}


export const getManualMethods = async (req,res)=>{
 const methods = await prisma.manualPaymentMethod.findMany({
  orderBy:{name:"asc"}
 })
 res.json(methods)

}

export const createManualMethod = async (req,res)=>{
 const {name,instructions,verificationRequired,supportedCurrencies} = req.body
 const method = await prisma.manualPaymentMethod.create({
  data:{
   name,
   instructions,
   verificationRequired,
   supportedCurrencies
  }
 })
 res.json(method)
}


export const getPaymentSettings = async (req,res)=>{
 const settings = await prisma.paymentSettings.findFirst()
 res.json(settings)

}

export const updatePaymentSettings = async (req,res)=>{
 const settings = await prisma.paymentSettings.update({
  where:{id:1},
  data:req.body
 })
 res.json(settings)
}
