const PORT = process.env.PORT || 3000;
const express = require('express');
const app = express();
const http = require("http").Server(app);
const io = require('socket.io')(http);
const _ = require('lodash');

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/room/*', (req, res) => res.sendFile(__dirname + '/index.html'));

app.use(express.static(__dirname + '/public'));

function generateRoom() { //Génère une room aléatoire à 6 char
    let char = "0123456789abcdefghijklmnopqrstuvwxyz";
    let roomName = "";
    while (roomName == "" || (_.includes(Object.keys(io.sockets.adapter.rooms), roomName))) { //tant que room name existe déjà / roomName == "" sert à vérifier si c'est le premier passage
        roomName = "";
        for (let i = 0; i < 6; i++) {
            roomName += char[Math.floor((Math.random() * (char.length)) + 0)];
        }
    }

    return roomName;
}

function getUsersInRoom(roomName) {
    try {
        return Object.keys(io.sockets.adapter.rooms[roomName].sockets);
    }
    catch(err) {
        console.log("Can't get Users in room : " + err);
    }
}

//to get a socket by its ID : io.sockets.connected[socket.id]

function getUsernamesInRoom(roomName) {
    try {
        return getUsersInRoom(roomName).map(function (id) {
            return io.sockets.connected[id].pseudo
        });
    }
    catch(err) {
        console.log("Can't get Usernames in room : " + err);
    }
}

function getIdByPseudo(pseudo, room) {
    try {
        let pseudoIndex = _.indexOf(getUsernamesInRoom(room), pseudo); //cherche l'index du pseudo dans la liste qui est une transcription de la liste des ID en pseudo
        return getUsersInRoom(room)[pseudoIndex]; //retourne l'id avec l'index du pseudo correspondant
    } catch(err) {
        console.log("Can't get Id with pseudo : " + err);
    }
}

function socketFlush(socket) { //Reset le socket et ses informations
    delete socket.pseudo;
    delete socket.room;
    delete socket.admin;
    delete socket.isConnected;
};

class Card {
    constructor(number, family, fullName) {
        this.number = number;
        this.family = family;
        this.fullName = fullName;
        this.imgSrc = "/images/cards/" + number + family + ".svg";
    }
}

//Initialisation des cartes de la partie
const zeroRed = new Card("0", "red", "0 Rouge");
const oneRed = new Card("1", "red", "1 Rouge");
const twoRed = new Card("2", "red", "2 Rouge");
const threeRed = new Card("3", "red", "3 Rouge");
const fourRed = new Card("4", "red", "4 Rouge");



io.on('connection', (socket) => {
    console.log("Nouvelle connexion ! " + socket.id)
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
            //Suppression des données temporaires
            socketFlush(socket);
            socket.pseudo = socket.tempPseudo;
            delete socket.tempPseudo;

            socket.room = generateRoom();
            socket.emit('hide-connexion');
            socket.join(socket.room);
            io.sockets.adapter.rooms[socket.room].mutedList = [];
            socket.emit('refresh-mutedList', io.sockets.adapter.rooms[socket.room].mutedList); //on envoit la liste des muted (théoriquement vide)
            console.log(io.sockets.adapter.rooms[socket.room])
            socket.isConnected = true;
            socket.emit('update-room', {"room" : socket.room});
            socket.admin = socket.room; //On défini sur quel room le socket est admin (créateur de la partie), cela évite un exploit qui consiste à changer de room en étant admin dans une autre et devenir admin de la nouvelle room

            //Affichage des éléments d'admin de la partie
            socket.emit('toggle-nav-el', {
                'element': 'OptionMenu',
                'option': true
            });
            socket.emit('toggle-nav-el', {
                'element': 'StartButton',
                'option': true
            });

            //Notifications de création de la partie
            socket.emit('show-toast', {
                "title": "Succès",
                "desc": "Vous avez bien créé la room #" + socket.room + ".",
                "variant": "success",
                "toaster": "b-toaster-bottom-center"
            });
            io.to(socket.room).emit('show-chat-message', {
                "sender": "",
                "message": socket.pseudo + " a créé la partie #" + socket.room,
                "style": "list-group-item-light"
            });

            //Actualisation de la liste des joueurs
            io.to(socket.room).emit('refresh-playerlist', {
                'playerList': getUsernamesInRoom(socket.room)
            });
        }
    })

    socket.on('join-room', function (data) {
        socket.tempPseudo = data.pseudo.trim().toString();
        socket.tempRoom = data.room.trim().toString();
        if ((socket.tempPseudo.length < 3 || socket.tempPseudo.length > 20) || (socket.tempRoom.length != 6) || (!_.includes(Object.keys(io.sockets.adapter.rooms), socket.tempRoom))) { //Vérifie si le nom de la room et le pseudo sont conformes et qu'elle existe
            //Pseudo trop court, trop long, la room n'a pas 6 caractères ou elle n'existe pas
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Votre pseudo ou le nom de la room est invalide.",
                "variant": "danger",
                "toaster": "b-toaster-top-center"
            });
            delete socket.tempPseudo;
            delete socket.tempRoom;
        } else if (_.includes(getUsersInRoom(socket.tempRoom), socket.id)) { //Vérifie si le socket essai de se reconnecter au même salon
            //Même salon
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Vous êtes déjà connecté dans ce salon.",
                "variant": "danger",
                "toaster": "b-toaster-top-center"
            });
            delete socket.tempPseudo;
            delete socket.tempRoom;
        } else if (_.includes(getUsernamesInRoom(socket.tempRoom), socket.tempPseudo)) { //Vérifie si le pseudo que le socket souhaite utiliser est déjà utilisé dans le salon
            //Qlq a déjà le même pseudo dans cette room
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Votre pseudo est déjà utilisé dans ce salon.",
                "variant": "danger",
                "toaster": "b-toaster-top-center"
            });
            delete socket.tempPseudo;
            delete socket.tempRoom;
        } else {
            //Suppression des données temporaires
            socketFlush(socket);
            socket.pseudo = socket.tempPseudo;
            socket.room = socket.tempRoom;
            delete socket.tempPseudo;
            delete socket.tempRoom;

            socket.emit('hide-connexion'); //Fermeture de la page de connexion
            socket.join(socket.room);
            console.log(io.sockets.adapter.rooms[socket.room]);
            socket.isConnected = true;
            socket.emit('update-room', {"room" : socket.room});

            //Actualisation de la liste des joueurs
            io.to(socket.room).emit('refresh-playerlist', {
                'playerList': getUsernamesInRoom(socket.room)
            });

            //Notification de la connexion
            socket.emit('show-toast', {
                "title": "Succès",
                "desc": "Vous avez bien rejoint la room #" + socket.room + ".",
                "variant": "success",
                "toaster": "b-toaster-bottom-center"
            });
            socket.broadcast.to(socket.room).emit('show-toast', {
                "title": "Information",
                "desc": socket.pseudo + " a rejoint la partie.",
                "variant": "primary",
                "toaster": "b-toaster-bottom-left"
            });
            io.to(socket.room).emit('show-chat-message', {
                "sender": "",
                "message": socket.pseudo + " a rejoint la partie.",
                "style": "list-group-item-light"
            });
        }
    })

    socket.on('toggle-mute', function (mutedPseudo) {
        //Lorsqu'on reçoit l'information de désactiver ou activer le mute sur qlq
        if (socket.admin == socket.room) { //Vérification si admin
            if (socket.pseudo != mutedPseudo && _.includes(getUsernamesInRoom(socket.room), mutedPseudo)) { //On empêche l'admin de se mute lui même et on vérifie si le joueur existe
                if (!_.includes(io.sockets.adapter.rooms[socket.room].mutedList, mutedPseudo)) { //Si mutedList ne contient pas encore ce joueur
                    io.sockets.adapter.rooms[socket.room].mutedList.push(mutedPseudo); //ajoute ce joueur à la liste
                    io.to(socket.room).emit('show-chat-message', {
                        "sender": "",
                        "message": mutedPseudo + " a été mute.",
                        "style": "list-group-item-warning"
                    });
                } else {
                    io.sockets.adapter.rooms[socket.room].mutedList = _.remove(io.sockets.adapter.rooms[socket.room].mutedList, function(element) {
                        return element != mutedPseudo;
                    }); //On retire le pseudo s'il est déjà dans la liste grâce à un filtre
                    io.to(socket.room).emit('show-chat-message', {
                        "sender": "",
                        "message": mutedPseudo + " a été démute.",
                        "style": "list-group-item-warning"
                    });
                }
                socket.emit('refresh-mutedList', io.sockets.adapter.rooms[socket.room].mutedList); //on renvoit la liste des muted
            }
        } else {
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Vous devez être admin pour faire cela.",
                "variant": "danger",
                "toaster": "b-toaster-bottom-right"
            });
        }
    })

    socket.on('send-message', function (data) {
        if (socket.isConnected == false) {
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Vous devez être connecté pour faire cela.",
                "variant": "danger",
                "toaster": "b-toaster-bottom-right"
            });
        } else if (_.includes(io.sockets.adapter.rooms[socket.room].mutedList, socket.pseudo)) {
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Vous ne pouvez pas parler car vous avez été mute par le créateur du salon.",
                "variant": "warning",
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
    });

    socket.on('kick-player', function (kickedPseudo) {
        if (socket.admin == socket.room) { //Si le joueur qui demande le kick est l'admin
            if (socket.pseudo != kickedPseudo && _.includes(getUsernamesInRoom(socket.room), kickedPseudo)) { //Si le joueur à kick n'est pas lui-même et si il existe bien
                
                let kickedSocket = io.sockets.connected[getIdByPseudo(kickedPseudo, socket.room)];

                //Annonce au joueur kick
                kickedSocket.emit('show-toast', {
                    "title": "Information",
                    "desc": "Vous avez été kick de la partie.",
                    "variant": "danger",
                    "toaster": "b-toaster-top-center"
                });

                //Déconnexion du joueur kick
                kickedSocket.emit('show-connexion'); //On affiche la page de connexion au socket kicked
                kickedSocket.leave(socket.room);
                socketFlush(kickedSocket);

                //Annonce à tout le monde
                io.to(socket.room).emit('show-toast', {
                    "title": "Information",
                    "desc": kickedPseudo + " a été kick de la partie.",
                    "variant": "danger",
                    "toaster": "b-toaster-bottom-left"
                });
                io.to(socket.room).emit('show-chat-message', {
                    "sender": "",
                    "message": kickedPseudo + " a été kick de la partie.",
                    "style": "list-group-item-danger"
                });
    
                //Actualisation de la liste des joueurs
                io.to(socket.room).emit('refresh-playerlist', {
                    'playerList': getUsernamesInRoom(socket.room)
                });
            }
        } else { //S'il était simple joueur
            socket.emit('show-toast', {
                "title": "Erreur",
                "desc": "Vous devez être admin pour faire cela.",
                "variant": "danger",
                "toaster": "b-toaster-bottom-right"
            });
        }
    });

    socket.on('disconnect', function () {
        if (socket.admin == socket.room) { //Si le joueur qui a quitté était admin de la partie
            socket.broadcast.to(socket.room).emit('show-toast', {
                "title": "Information",
                "desc": "La partie a été fermée car le créateur de celle-ci est parti.",
                "variant": "warning",
                "toaster": "b-toaster-top-center"
            });
            socket.broadcast.to(socket.room).emit('show-connexion'); //On affiche la page de connexion aux sockets sauf à celui qui a quitté
            try {
                for (userID of getUsersInRoom(socket.room)) {
                    let user = io.sockets.connected[userID]; //On récupère le socket et on le place dans user
                    user.leave(socket.room); //Fait quitter la room à tous les utilisateurs de celle-ci
                    socketFlush(user); //On reset chaque socket présent dans la room
                }
            } catch(err) {
                console.log("Can't disconnect users in room : " + err);
            }
        } else { //Si il était simple joueur
            socket.broadcast.to(socket.room).emit('show-toast', {
                "title": "Information",
                "desc": socket.pseudo + " a quitté la partie.",
                "variant": "primary",
                "toaster": "b-toaster-bottom-left"
            });
            io.to(socket.room).emit('show-chat-message', {
                "sender": "",
                "message": socket.pseudo + " a quitté la partie.",
                "style": "list-group-item-light"
            });
    
            //Actualisation de la liste des joueurs
            io.to(socket.room).emit('refresh-playerlist', {
                'playerList': getUsernamesInRoom(socket.room)
            });
        }
        
    });
})


http.listen(PORT, () => console.log("Server listening on port" + PORT))