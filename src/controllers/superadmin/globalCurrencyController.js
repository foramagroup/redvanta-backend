import prisma from "../../config/database.js";

export const getGlobalCurrencies = async (req,res)=>{
 try{
  const page = parseInt(req.query.page) || 1
  const limit = parseInt(req.query.limit) || 10
  const skip = (page-1)*limit
  const [data,total] = await Promise.all([
    prisma.globalCurrency.findMany({
      skip,
      take:limit,
      orderBy:{code:"asc"}
    }),
    prisma.globalCurrency.count()
  ])
  res.json({
    data,
    pagination:{
      total,
      page,
      limit,
      totalPages:Math.ceil(total/limit)
    }
  })
 }catch(e){
  res.status(500).json({message:e.message})
 }

}

export const createGlobalCurrency = async (req,res)=>{
 try{
  const {code,name,symbol,rate,gateway,position} = req.body
  const currency = await prisma.globalCurrency.create({
    data:{
      code:code.toUpperCase(),
      name,
      symbol,
      rate:parseFloat(rate),
      gateway,
      symbolPosition:position
    }

  })
  res.json(currency)
 }catch(e){
  res.status(500).json({message:e.message})
 }

}


export const updateGlobalCurrency = async (req,res)=>{

 try{

  const {id} = req.params

  const {name,symbol,rate,gateway,position,status} = req.body

  const currency = await prisma.globalCurrency.update({

    where:{id:Number(id)},

    data:{
      name,
      symbol,
      rate:parseFloat(rate),
      gateway,
      symbolPosition:position,
      status
    }

  })

  res.json(currency)

 }catch(e){

  res.status(500).json({message:e.message})

 }

}


export const deleteGlobalCurrency = async (req,res)=>{
 try{
  const {id} = req.params
  await prisma.globalCurrency.delete({
    where:{id:Number(id)}
  })
  res.json({message:"Currency deleted"})
 }catch(e){
  res.status(500).json({message:e.message})
 }
}

export const getCurrencySettings = async (req,res)=>{
  try{

    const settings = await prisma.globalCurrencySettings.findFirst()

    res.json(settings)

  }catch(e){
    res.status(500).json({message:e.message})
  }
}


export const updateCurrencySettings = async (req,res)=>{
  try{
    const {
      conversionMethod,
      rateProvider,
      apiKey,
      showSelector,
      showBoth,
      rounding
    } = req.body
    const settings = await prisma.globalCurrencySettings.update({
      where:{ id:1 },
      data:{
        conversionMethod,
        rateProvider,
        apiKey,
        showSelector,
        showBoth,
        rounding
      }
    })
    res.json(settings)
  }catch(e){
    res.status(500).json({message:e.message})
  }
}

