import prisma from "../../config/database.js";





export const getLanguages = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10
    const skip = (page - 1) * limit

    const [languages, total] = await Promise.all([
      prisma.language.findMany({
        orderBy: { name: "asc" },
        skip,
        take: limit
      }),
      prisma.language.count()
    ])

    res.json({
      data: languages,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (e) {
    res.status(500).json({ message: e.message })
  }
}


export const getTranslations = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const skip = (page - 1) * limit
    const [data, total] = await Promise.all([
      prisma.translationKey.findMany({
        skip,
        take: limit,
        include: {
          translations: {
            include: {
              language: true
            }
          }
        },
        orderBy: {
          key: "asc"
        }
      }),
      prisma.translationKey.count()
    ])

    res.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })

  } catch (e) {
    res.status(500).json({ message: e.message })
  }
}



export const createKey = async (req,res)=>{
  try{
    const {key,translations} = req.body
    const newKey = await prisma.translationKey.create({
      data:{ key }
    })

    if(translations){
      const langs = await prisma.language.findMany()
      for(const lang of langs){
        if(translations[lang.code]){
          await prisma.translation.create({
            data:{
              keyId:newKey.id,
              languageId:lang.id,
              value:translations[lang.code]
            }
          })

        }
      }
    }
    res.json({message:"Key created"})

  }catch(e){
    res.status(500).json({message:e.message})
  }
}


export const updateTranslation = async (req,res)=>{
  try{
    const {keyId,languageId,value} = req.body
    await prisma.translation.upsert({
      where:{
        keyId_languageId:{
          keyId,
          languageId
        }
      },

      update:{value},

      create:{
        keyId,
        languageId,
        value
      }

    })
    res.json({message:"Translation updated"})
  }catch(e){
    res.status(500).json({message:e.message})
  }
}

export const deleteKey = async (req,res)=>{
  const {id}=req.params
  await prisma.translationKey.delete({
    where:{id:Number(id)}
  })
  res.json({message:"Deleted"})
}