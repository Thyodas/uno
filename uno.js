const PORT = process.env.PORT || 3000;
const express = require('express')
const app = express()
const http = require("http").Server(app)
const io = require('socket.io')(http)

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'))
app.use(express.static(__dirname + '/public'));

function generateRoom() {
    let char = "0123456789abcdefghijklmnopqrstuvwxyz";
    let roomName = "";
    for (let i = 0; i < 6; i++) {
        roomName += char[Math.floor((Math.random() * (char.length)) + 0)];
      }
    return roomName;
}

class Card {
    constructor(number, family, fullName) {
      this.number = number;
      this.family = family;
      this.fullName = fullName;
      this.imgSrc = "images/cards/" + number + family + ".svg";
    }
  }

  //Initialisation des cartes de la partie
  const zeroRed = new Card("0", "red", "0 Rouge");
  const oneRed = new Card("1", "red", "1 Rouge");
  const twoRed = new Card("2", "red", "2 Rouge");
  const threeRed = new Card("3", "red", "3 Rouge");
  const fourRed = new Card("4", "red", "4 Rouge");



io.on('connection', (socket) => {
            console.log("Nouvelle connexion !")
            socket.emit('show-connexion')

            socket.on('create-room', function (data) {
                socket.tempPseudo = data.pseudo.trim().toString();
                if (socket.tempPseudo.length < 3 || socket.tempPseudo.length > 20) {
                    socket.emit('show-toast', {
                        "title": "Erreur",
                        "desc": "Votre pseudo est invalide.",
                        "variant": "danger",
                        "toaster": "b-toaster-top-center"
                    });
                    delete socket.tempPseudo;
                } else {
                    socket.pseudo = socket.tempPseudo;
                    delete socket.tempPseudo;
                    socket.room = generateRoom();
                    socket.emit('hide-connexion');
                    socket.join(socket.room);
                    socket.emit('show-toast', {
                        "title": "Succès",
                        "desc": "Vous avez bien créé la room #" + socket.room + ".",
                        "variant": "success",
                        "toaster": "b-toaster-top-center"
                    });
                    io.to(socket.room).emit('show-chat-message', {
                        "sender": "",
                        "message": socket.pseudo + " a créé la partie #" + socket.room,
                        "style": "list-group-item-light"
                    });
                }
            })

            socket.on('join-room', function (data) {
                socket.tempPseudo = data.pseudo.trim().toString();
                socket.tempRoom = data.room.trim().toString();
                if ((socket.tempPseudo.length < 3 || socket.tempPseudo.length > 20) || (socket.tempRoom.length != 6)) {
                    socket.emit('show-toast', {
                        "title": "Erreur",
                        "desc": "Votre pseudo ou le nom de la room est invalide.",
                        "variant": "danger",
                        "toaster": "b-toaster-top-center"
                    });
                    delete socket.tempPseudo;
                    delete socket.tempRoom;
                } else {
                    socket.pseudo = socket.tempPseudo;
                    socket.room = socket.tempRoom;
                    delete socket.tempPseudo;
                    delete socket.tempRoom;
                    console.log(socket.pseudo + " veut rejoindre la room #" + socket.room);
                    socket.emit('hide-connexion');
                    socket.join(socket.room);
                    socket.emit('show-toast', {
                        "title": "Succès",
                        "desc": "Vous avez bien rejoint la room #" + socket.room + ".",
                        "variant": "success",
                        "toaster": "b-toaster-top-center"
                    });
                    socket.broadcast.to(socket.room).emit('show-toast', {
                        "title": "Information",
                        "desc": socket.pseudo + " a rejoint la partie #" + socket.room,
                        "variant": "primary",
                        "toaster": "b-toaster-bottom-left"
                    });
                    io.to(socket.room).emit('show-chat-message', {
                        "sender": "",
                        "message": socket.pseudo + " a rejoint la partie #" + socket.room,
                        "style": "list-group-item-light"
                    });
                }
             })

             socket.on('send-message', function (data) {
                if (socket.pseudo == undefined) {
                    socket.emit('show-toast', {
                        "title": "Erreur",
                        "desc": "Vous devez être connecté pour faire cela.",
                        "variant": "danger",
                        "toaster": "b-toaster-bottom-right"
                    });
                } else if (data.message.trim().toString() == "") {
                    socket.emit('show-toast', {
                        "title": "Erreur",
                        "desc": "Votre message est vide.",
                        "variant": "danger",
                        "toaster": "b-toaster-bottom-right"
                    });
                } else {
                    io.to(socket.room).emit('show-chat-message', {
                        "sender": socket.pseudo,
                        "message": data.message,
                        "style": ""
                    });
                }
            })




                socket.on('disconnect', function () {
                    console.log("Quelqu'un s'est déconnecté !")
                });
            })


            http.listen(PORT, () => console.log("Server listening on port" + PORT))