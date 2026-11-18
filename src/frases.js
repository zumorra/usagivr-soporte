"use strict";
/**
 * Frases con las que el bot pasa el caso a un compañero (Helpper).
 * Se elige una al azar para que no suene a robot. Cada una recibe la mencion del compañero.
 * Reglas: nunca un precio ni un aproximado, nunca prometer cambios, reembolsos ni garantia.
 */

// Precios y compras: si puede comprar, pero los precios solo los da un compañero.
const compraEs = [
  "Deja te comunico con uno de mis compañeros para eso, pero claro que puedes comprar. {r} te escribe aquí mismo.",
  "¡Claro que sí se puede comprar! Los precios te los pasa un compañero, ya le avisé a {r}.",
  "Va, sí puedes comprarlo. Para los precios te paso con {r}, que te escribe aquí en cuanto se conecte.",
  "¡Sí, claro! De precios y compras se encarga un compañero; ya le dejé tu caso a {r}.",
  "Claro que puedes. Deja te comunico con {r} para que te dé los precios y te ayude con la compra.",
  "Sí se puede comprar, no te preocupes. Los precios te los da {r}, ya le avisé para que te escriba aquí.",
  "¡Con gusto! Para comprar te atiende un compañero: {r} te escribe por aquí con todos los detalles.",
  "Claro, sí vendemos eso y lo puedes comprar. Te paso con {r}, que es quien te puede dar el precio.",
  "Sí puedes comprarlo, sale. Para eso te comunico con {r}, que te ayuda con precio y compra.",
  "¡Claro que sí lo puedes comprar! Ya le avisé a {r} para que te pase los precios aquí mismo.",
  "Va, de eso te ayuda un compañero. Sí puedes comprarlo; {r} te escribe en cuanto se conecte.",
  "Sí, claro que se puede comprar. Deja le aviso a {r} para que te dé los precios.",
  "¡Perfecto! Sí puedes comprar más. Te comunico con {r} para que te ayude con eso.",
  "Claro que puedes comprar. Los precios solo los manejan mis compañeros, así que ya le avisé a {r}.",
  "Sí se puede, tranqui. Te paso con {r} para que te diga precios y cómo hacer la compra.",
  "¡Buena idea! Sí puedes comprarlo. {r} te escribe aquí para darte los detalles.",
  "Claro, con todo gusto. Deja te comunico con {r}, que es quien ve las compras.",
  "Sí puedes comprarlo, claro. Para el precio te atiende {r}; ya le dejé tu mensaje.",
  "Va, sí se puede comprar aparte. Te comunico con {r} para los precios.",
  "¡Claro! De compras y precios se encarga un compañero: ya le avisé a {r} y te escribe aquí.",
  "Sí, se puede comprar. Ya le pasé tu pregunta a {r} para que te dé el precio.",
  "Claro que sí puedes comprarlo. Deja te comunico con {r} para que te atienda.",
  "¡Sale! Sí puedes comprar. Te paso con {r}, que te da los precios en cuanto se conecte.",
  "Con gusto te ayudamos con eso. Sí puedes comprarlo; {r} te escribe aquí con los precios.",
  "Claro, sí se puede comprar. Para eso te comunico con un compañero: {r} ya está avisado.",
  "Sí puedes comprarlo, claro. Los precios te los pasa {r} aquí mismo.",
  "¡Claro que sí puedes comprar! Deja te comunico con {r} para que vean juntos lo que necesitas.",
  "Va, sí lo vendemos. Ya le avisé a {r} para que te dé el precio y te ayude a comprarlo.",
  "Sí se puede, no hay problema. Te comunico con {r}, que se encarga de las compras.",
  "Claro que puedes comprar más. Deja le aviso a {r} para que te pase la info.",
  "¡Claro! Sí puedes comprarlo. Para precios te atiende {r} en cuanto se conecte.",
  "Sí, claro que lo puedes comprar. De eso te ayuda mejor un compañero: ya le dejé tu caso a {r}.",
  "Por supuesto que sí puedes comprarlo. Te comunico con {r} para el precio.",
  "¡Sí se puede! Deja te paso con {r}, que te dice cuánto sale y cómo comprarlo.",
  "Claro, sí puedes comprarlo aparte. Ya le avisé a {r} y te escribe aquí.",
  "Va, sí puedes comprarlo. Los precios no los manejo yo, pero {r} te los pasa enseguida que se conecte.",
  "¡Claro que sí! Te comunico con {r} para que te ayude con tu compra.",
  "Sí puedes comprarlo, sin problema. Deja le aviso a {r} para que te dé los detalles.",
  "Claro, se puede comprar. Para eso te atiende un compañero; {r} te escribe por aquí.",
  "¡Sí, con gusto puedes comprarlo! Deja te comunico con {r}, que te pasa precios y opciones.",
];
const compraEn = [
  "Let me connect you with one of my teammates for that, but of course you can buy it. {r} will write to you right here.",
  "Sure, you can definitely buy that! A teammate handles prices, I already let {r} know.",
  "Yes, you can buy it. For prices I'm passing you to {r}, who'll write here as soon as they're on.",
  "Of course! A teammate takes care of prices and purchases; I already passed your case to {r}.",
  "Sure you can. Let me connect you with {r} so they can give you the prices and help with the order.",
  "Yes, you can buy it, no worries. {r} will give you the prices, I already asked them to write here.",
  "Happy to help! A teammate handles purchases: {r} will write here with all the details.",
  "Sure, we sell that. I'm passing you to {r}, who can give you the price.",
  "Yes, you can buy it. For that I'm connecting you with {r}, who'll help with the price and order.",
  "Of course you can buy it! I already let {r} know so they can send you the prices right here.",
  "Got it, a teammate helps with that. Yes, you can buy it; {r} will write as soon as they're on.",
  "Yes, you can buy it. Let me ping {r} so they can give you the prices.",
  "Great! Yes, you can buy more. I'm connecting you with {r} to help with that.",
  "Sure you can buy it. Only my teammates handle prices, so I already let {r} know.",
  "Yes, no problem. I'm passing you to {r} to go over prices and how to order.",
  "Good idea! You can buy it. {r} will write here with the details.",
  "Sure, gladly. Let me connect you with {r}, who handles purchases.",
  "Yes, of course you can buy it. {r} will help you with the price; I already left them your message.",
  "Yes, you can buy it separately. I'm connecting you with {r} for prices.",
  "Sure! A teammate handles purchases and prices: I let {r} know and they'll write here.",
  "Yes, you can buy that. I passed your question to {r} so they can give you the price.",
  "Of course you can buy it. Let me connect you with {r} to help you out.",
  "You got it! You can buy it. I'm passing you to {r}, who'll share prices as soon as they're on.",
  "Happy to help with that. Yes, you can buy it; {r} will write here with the prices.",
  "Sure, you can buy it. A teammate handles it: {r} is already in the loop.",
  "Yes, you can buy it. {r} will send you the prices right here.",
  "Of course you can buy it! Let me connect you with {r} so you can sort out what you need together.",
  "Yes, we sell it. I already let {r} know so they can give you the price and help you order.",
  "That's possible, no problem. I'm connecting you with {r}, who takes care of purchases.",
  "Sure, you can buy more. Let me ping {r} so they can send you the info.",
  "Of course! You can buy it. {r} will help with prices as soon as they're on.",
  "Yes, sure you can buy it. A teammate can help better with that: I passed your case to {r}.",
  "Absolutely, you can buy it. I'm connecting you with {r} for the price.",
  "Yes, you can! Let me pass you to {r}, who'll tell you the price and how to order.",
  "Sure, you can buy it separately. I let {r} know and they'll write here.",
  "Yes, you can buy it. I don't handle prices, but {r} will send them as soon as they're on.",
  "Of course! I'm connecting you with {r} to help with your purchase.",
  "Yes, you can buy it, no problem. Let me ping {r} so they can give you the details.",
  "Sure, you can purchase it. A teammate takes care of it; {r} will write to you here.",
  "Yes, you can buy it, gladly! Let me connect you with {r}, who'll share prices and options.",
];
// Ya hay un compañero en el ticket y vuelve a preguntar por precios.
const compraYaEs = [
  "Claro que puedes comprarlo. Ya le avisé a mi compañero y te pasa los precios aquí mismo.",
  "Sí se puede. Los precios te los da mi compañero, ya está avisado y te escribe por aquí.",
  "Va, sí puedes comprarlo. Mi compañero ya tiene tu caso y te pasa el precio en cuanto se conecte.",
  "¡Claro! Ya le dejé tu pregunta a mi compañero para que te dé los precios.",
  "Sí puedes, tranqui. Mi compañero ya viene y te ayuda con precio y compra.",
];
const compraYaEn = [
  "Of course you can buy it. My teammate is already in the loop and will send you the prices here.",
  "Yes, that's possible. My teammate handles prices and is already on it; they'll write here.",
  "Sure, you can buy it. My teammate already has your case and will share the price as soon as they're on.",
  "Of course! I already passed your question to my teammate so they can give you the prices.",
  "Yes, you can, no worries. My teammate is on the way and will help with price and order.",
];

// Devoluciones, cambios, recambios, reemplazos, cancelaciones o garantia.
const devolucionEs = [
  "Va, deja te comunico con uno de mis compañeros para eso. Ya le dejé tu caso a {r} y te atiende aquí mismo.",
  "Claro, de eso se encarga un compañero. {r} ya tiene tu caso y te escribe aquí en cuanto se conecte.",
  "Entiendo. Para eso te paso con {r}, que te ayuda a verlo bien.",
  "Sale, eso lo ve un compañero. Ya le avisé a {r} para que te escriba aquí.",
  "No te preocupes, te comunico con {r}, que ve ese tipo de casos y te escribe por aquí.",
  "Va, ya le pasé tu caso a {r}. Te escribe aquí mismo para revisarlo contigo.",
  "Claro, para eso te atiende un compañero. Ya le avisé a {r}.",
  "Entendido. Deja te comunico con {r}, que te ayuda con eso en cuanto se conecte.",
  "Tranqui, eso lo revisa {r}. Ya le dejé todo tu caso para que no tengas que repetirlo.",
  "Sale, te paso con {r} para que lo vean juntos. Te escribe aquí mismo.",
  "Claro que sí, te comunico con {r}. Ya tiene tu caso y te atiende por aquí.",
  "Va, de eso te ayuda mejor un compañero. {r} te escribe aquí en cuanto pueda.",
];
const devolucionEn = [
  "Got it, let me connect you with one of my teammates for that. I already passed your case to {r} and they'll help you right here.",
  "Sure, a teammate handles that. {r} already has your case and will write here as soon as they're on.",
  "I understand. For that I'm passing you to {r}, who'll help you look at it properly.",
  "Okay, a teammate handles that. I let {r} know so they can write to you here.",
  "No worries, I'm connecting you with {r}; they handle these cases and will write to you here.",
  "Got it, I passed your case to {r}. They'll write here to go over it with you.",
  "Sure, a teammate takes care of that. I already let {r} know.",
  "Understood. Let me connect you with {r}, who'll help with that as soon as they're on.",
  "No worries, {r} will check that. I left them your whole case so you don't have to repeat it.",
  "Okay, I'm passing you to {r} so you can look at it together. They'll write right here.",
  "Of course, I'm connecting you with {r}. They have your case and will help you here.",
  "Got it, a teammate can help you better with that. {r} will write here as soon as they can.",
];

// Foto (o mensaje) de algo roto o mojado.
const fotoEs = [
  "¡Gracias por la foto! Deja te comunico con uno de mis compañeros para que la revise; {r} te escribe aquí mismo.",
  "Ya me llegó la foto, gracias. Se la paso a {r} para que la vea bien y te diga cómo seguimos.",
  "Gracias, ya la vi. Esto lo revisa mejor un compañero: ya le dejé tu caso a {r}.",
  "¡Listo, ya tengo la foto! Te comunico con {r} para que la revise y te escriba aquí.",
  "Gracias por mandarla. Deja le paso la foto a {r}, que te atiende aquí en cuanto se conecte.",
  "Ya la recibí, gracias. Para esto te paso con {r}; ya tiene la foto y tu caso.",
  "Gracias, con esto ya se puede revisar. Te comunico con {r} para que lo vea contigo.",
  "¡Gracias! Le dejo la foto a {r}, que te escribe aquí mismo para revisarlo.",
  "Ya me llegó, gracias. Esto lo checa un compañero: {r} te escribe por aquí.",
  "Gracias por la foto. Te paso con {r} para que la revise bien.",
  "Recibida, gracias. Deja te comunico con {r}, que ya tiene tu foto y tu caso.",
  "¡Gracias! Con la foto ya le avisé a {r} para que lo revise y te diga.",
];
const fotoEn = [
  "Thanks for the photo! Let me connect you with one of my teammates to check it; {r} will write to you right here.",
  "Got the photo, thanks. I'm passing it to {r} so they can take a good look and tell you what's next.",
  "Thanks, I saw it. A teammate can check this better: I passed your case to {r}.",
  "All set, got the photo! I'm connecting you with {r} to check it and write to you here.",
  "Thanks for sending it. Let me pass the photo to {r}, who'll help you here as soon as they're on.",
  "Got it, thanks. I'm passing you to {r}; they already have the photo and your case.",
  "Thanks, with this it can be checked. I'm connecting you with {r} to look at it with you.",
  "Thanks! I'm leaving the photo with {r}, who'll write right here to check it.",
  "Got it, thanks. A teammate will check this: {r} will write to you here.",
  "Thanks for the photo. I'm passing you to {r} to take a proper look.",
  "Received, thanks. Let me connect you with {r}, who has your photo and your case.",
  "Thanks! With the photo I let {r} know so they can check it and get back to you.",
];

// Cliente molesto: calmar, acompañar y ofrecer que se una otro compañero.
const enojoEs = [
  "No te preocupes, quiero acompañarte a resolverlo. Ya le pedí a {r} que se una para darte una mejor atención.",
  "Perdón por la lata, entiendo que es frustrante. Aquí sigo contigo, y ya le avisé a {r} para que se una y lo vea en persona.",
  "Es normal que esto te moleste, lo siento. Vamos a resolverlo juntos; ya le pedí a {r} que se sume para ayudarte mejor.",
  "Lamento mucho la molestia. No te voy a dejar con esto sin resolver: ya llamé a {r} para que se una y te atienda personalmente.",
  "Entiendo cómo te sientes y lo siento. Quiero ayudarte a que quede; también le pedí a {r} que se una al ticket.",
  "Tranqui, lo vamos a sacar. Ya le avisé a {r} para que se una y te dé una mejor atención.",
  "Perdón por todo esto, de verdad. Te acompaño a resolverlo y ya le pedí a {r} que se sume para revisarlo contigo.",
  "Entiendo la frustración, nadie quiere pasar por esto. Ya le avisé a {r} para que se una y lo veamos juntos.",
  "Lo siento mucho. Quiero que esto quede bien: ya le pedí a {r} que se una para darte mejor asistencia.",
  "Gracias por la paciencia, sé que no ha sido fácil. Ya le pedí a {r} que se una para atenderte en persona aquí mismo.",
  "No te preocupes, no te vamos a dejar así. Ya le pedí a {r} que se una para darte una mejor atención.",
  "Te entiendo y lo lamento. Sigo aquí contigo, y le pedí a {r} que se una para resolverlo juntos.",
];
const enojoEn = [
  "Don't worry, I want to help you get this solved. I already asked {r} to join so you get better support.",
  "Sorry for the trouble, I get that it's frustrating. I'm still here with you, and I asked {r} to join and look at it personally.",
  "You have every right to be upset, I'm sorry. Let's solve it together; I already asked {r} to join to help you better.",
  "I'm really sorry about this. You're not alone with it: I already called {r} to join and help you personally.",
  "I understand how you feel and I'm sorry. I want to get this fixed; I also asked {r} to join the ticket.",
  "Don't worry, we'll get it sorted. I already let {r} know so they can join and give you better support.",
  "Sorry for all of this, truly. I'll stay with you until it's solved and I asked {r} to join and check it with you.",
  "I get the frustration, nobody wants to go through this. I let {r} know so they can join and we look at it together.",
  "I'm very sorry. I want this to end well: I already asked {r} to join to give you better help.",
  "Thanks for your patience, I know it hasn't been easy. I asked {r} to join and help you personally right here.",
  "Don't worry, we won't leave it like this. {r} is already on their way to join and give you better support.",
  "I hear you and I'm sorry. I'm still here, and I asked {r} to join so we solve it together.",
];

// Pasaron unos minutos sin respuesta del primer compañero: se suma el segundo.
const segundoEs = [
  "Para no hacerte esperar, también le pedí a {r} que se una al ticket. El primero que se conecte te atiende.",
  "Ya le avisé también a {r} para que te atiendan más rápido; cualquiera de los dos te escribe aquí.",
  "Sumé a {r} al ticket para darte una mejor atención. En cuanto alguno se conecte te escribe.",
];
const segundoEn = [
  "So you don't wait too long, I also asked {r} to join the ticket. Whoever is on first will help you.",
  "I also let {r} know so you get help faster; either of them will write to you here.",
  "I added {r} to the ticket to give you better support. As soon as one is on, they'll write here.",
];

const azar = (l) => l[Math.floor(Math.random() * l.length)];
const con = (l) => (rol) => azar(l).replace("{r}", rol);
const fija = (l) => () => azar(l);

const FRASES = {
  es: { compra: compraEs, compraYa: compraYaEs, devolucion: devolucionEs, foto: fotoEs, enojo: enojoEs, segundo: segundoEs },
  en: { compra: compraEn, compraYa: compraYaEn, devolucion: devolucionEn, foto: fotoEn, enojo: enojoEn, segundo: segundoEn },
};

module.exports = { FRASES, con, fija };
