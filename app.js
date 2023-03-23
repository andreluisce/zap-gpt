const express = require('express');
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const qrCode = require('qrcode');
const qrcodeterminal = require('qrcode-terminal')

const axios = require('axios');
require('dotenv').config();

const port = process.env.PORT || 3000;

const app = express();

const client = new Client({
    authStrategy: new LocalAuth()
});

var qrCodeGenerated;
client.on('qr', qr => {
    qrcodeterminal.generate(qr, {small: true})
    
// Define a route to display the QR code
app.get('/', async (req, res) => {
    console.log({qr})
    qrCode.toDataURL(qr).then((qrCodeImage) => {
        res.send(`
        <h1>Scan the QR code to log in to WhatsApp</h1>
        <img src="${qrCodeImage}" alt="QR Code" />
      `)
    }).catch(error => {
        console.error(error)
    })

  
})


app.listen(port, () => console.log(`Example app listening on port ${port}!`));
});

client.on('authenticated', (session) => console.log(`Autenticado`));


client.on('message_create', message => commands(message))

client.initialize();


const headers = {
    'Authorization': `Bearer ${process.env.OPENAI_KEY}`,
    'Content-Type': 'application/json'
}

const axiosInstance = axios.create({
    baseURL: 'https://api.openai.com/',
    timeout: 120000,
    headers: headers
});

const getDavinciResponse = async (clientText) => {
    const body = {
        "model": "text-davinci-003",
        "prompt": clientText,
        "max_tokens": 2048,
        "temperature": 1
    }

    try {
        const { data } = await axiosInstance.post('v1/completions', body)
        const botAnswer = data.choices[0].text
        return `👨🏿‍🦳 A resposta do pai é ${botAnswer}`
    } catch (e) {
        return `❌ OpenAI Response Error`
    }
}

const getDalleResponse = async (clientText) => {
    const body = {
        prompt: clientText, // Descrição da imagem
        n: 1, // Número de imagens a serem geradas
        size: "256x256", // Tamanho da imagem
    }

    try {
        const { data } = await axiosInstance.post('v1/images/generations', body)
        return data.data[0].url
    } catch (e) {
        return `❌ OpenAI Response Error`
    }
}

const commands = async (message) => {
    const iaCommands = {
        davinci3: "/cleitin",
        dalle: "/img",
    }
    let firstWord = (message.body.substring(0, message.body.indexOf(" "))).toLowerCase()
   /*
    * Faremos uma validação no message.from
    * para caso a gente envie um comando
    * a response não seja enviada para
    * nosso próprio número e sim para 
    * a pessoa ou grupo para o qual eu enviei
    */
   

    const sender = message.from.includes(process.env.PHONE_NUMBER) ? message.to : message.from
    
    console.log(firstWord)

    switch (firstWord) {
        case iaCommands.davinci3:
            const question = message.body.substring(message.body.indexOf(" "));
            getDavinciResponse(question).then(async (response) => {
                const contact = await message.getContact()
                client.sendMessage(sender, `${response}\n\nA pergunta foi de @${contact.id.user}`, { mentions: [contact] })
            })
            break

        case iaCommands.dalle:
            const imgDescription = message.body.substring(message.body.indexOf(" "));
            const contact = await message.getContact();
            getDalleResponse(imgDescription, message).then(async (imgUrl)  => {
                const media = await MessageMedia.fromUrl(imgUrl)
                // Caso queira mandar como Sticker, acrescente em options -> sendMediaAsSticker: true
                const options = {
                    mentions: [contact], 
                    caption: `A pergunta foi de @${contact.id.user}`, 
                    media: media,
                    sendMediaAsSticker: true
                }
                await client.sendMessage(sender, media, options)
            })
            break
    }
}
