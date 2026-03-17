import prisma from "../../config/database.js";

export const getTemplates = async (req,res)=>{
    const templates = await prisma.smsTemplate.findMany({
        include:{
            translations:true
        }
    })

    res.json(templates)
}

export const createTemplate = async (req,res)=>{
 const {name,slug,category,active,body} = req.body
 const template = await prisma.smsTemplate.create({
   data:{
     name,
     slug,
     category,
     active,
     translations:{
       create: Object.keys(body).map(lang=>({
         language:lang,
         body:body[lang]
       }))
     }
   },
   include:{translations:true}
 })
 res.json(template)
}

export const updateTemplate = async (req,res)=>{
 const id = parseInt(req.params.id)
 const {name,slug,category,active,body} = req.body
 await prisma.smsTemplate.update({
   where:{id},
   data:{
     name,
     slug,
     category,
     active
   }
 })
 for(const lang in body){
   await prisma.smsTemplateTranslation.upsert({
     where:{
       templateId_language:{
         templateId:id,
         language:lang
       }
     },
     update:{
       body:body[lang]
     },
     create:{
       templateId:id,
       language:lang,
       body:body[lang]
     }
   })
 }

 res.json({message:"Template updated"})
}

export const deleteTemplate = async(req,res)=>{

 const id = parseInt(req.params.id)

 await prisma.smsTemplate.delete({
   where:{id}
 })

 res.json({message:"Template deleted"})
}
