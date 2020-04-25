var PORT = process.env.PORT || 3000;
const express = require('express')
const app = express()
const http = require("http").Server(app)
const io = require('socket.io')(http)

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'))



io.on('connection', (socket) => {
    console.log("Nouvelle connexion !")
    socket.emit('show-connexion')


    socket.on('join-room', function (data) {
        socket.pseudo = data.pseudo.trim().toString();
        socket.room = data.room.trim().toString();
        if ( ( socket.pseudo.length < 3 || socket.pseudo.length > 20 ) || ( socket.room.length != 6 ) ) {
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Votre pseudo ou le nom de la room est invalide.",
                "variant": "danger",
                "toaster": "b-toaster-top-center"
            });
        } else {
            console.log(socket.pseudo + " veut rejoindre la room #" + socket.room);
            socket.emit('hide-connexion');
            socket.emit('show-toast', {
                "title": "Succès",
                "desc": "Vous avez bien rejoint la room #" + socket.room +".",
                "variant": "success",
                "toaster": "b-toaster-top-center"
            });
            socket.broadcast.emit('show-toast', {
                "title": "Information",
                "desc": "Un nouveau joueur a rejoint la partie !",
                "variant": "primary",
                "toaster": "b-toaster-bottom-left"
            });
        }

        socket.on('send-message', function (data) {
            if (data.message.trim().toString() == "") {
                socket.emit('show-toast', {
                    "title": "Erreur",
                    "desc": "Votre message est vide.",
                    "variant": "danger",
                    "toaster": "b-toaster-bottom-right"
                });
                socket.emit('show-chat-message', {"sender": "Erreur", "message": "Votre message est vide.", "style": "list-group-item-danger"});
            } else {
                io.emit('show-chat-message', {"sender": socket.pseudo, "message": data.message, "style": ""});
            }
        })
        
    })

    


    socket.on('disconnect', function () {
        console.log("Quelqu'un s'est déconnecté !")
     });
})


http.listen(PORT, () => console.log("Server listening on port" + PORT))
