const socket = io();
let userVideo = document.getElementById("user-video");
let peerVideo = document.getElementById("peer-video");
let remotestream;
let roomName;
let creator = false;
let rtcPeerConnection;
let userStream;
let urlParams = new URLSearchParams(window.location.search);
let username = sessionStorage.getItem("name");
let peername;
let dataChannel;
// import pcConfig from "./config.js";

// add your stun and turn servers here
const pcConfig = {
  iceServers: [
    {
      urls: ["stun:stun1.1.google.com:19302", "stun:stun2.1.google.com:19302"],
    },
  ],
};

/* ----------------------------Webrtc functions----------------------------*/

const getvideo = async () => {
  try {
    userStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: { echoCancellation: true, noiseSuppression: true },
    });
    userVideo.srcObject = userStream;
    userVideo.onloadedmetadata = function (e) {
      userVideo.play();
    };
  } catch (error) {
    console.log("Can't access user media");
  }
};

const createConnection = async () => {
  try {
    remotestream = new MediaStream();
    peerVideo.srcObject = remotestream;
    socket.emit("sendDetails", roomName, { username });
    rtcPeerConnection = new RTCPeerConnection(pcConfig);
    rtcPeerConnection.onicecandidate = OnIceCandidateFunction;
    rtcPeerConnection.ontrack = OnTrackFunction;
    console.log(userStream);
    let sstream = userStream.getTracks();
    sstream.forEach((track) => {
      rtcPeerConnection.addTrack(track, userStream);
    });
    console.log("RTC connection established");
  } catch (error) {
    console.log(error);
  }
};

function createDatachannel() {
  dataChannel = rtcPeerConnection.createDataChannel("channel", {
    ordered: true,
  });
  dataChannel.onerror = (error) => {
    console.log("Data Channel Error:", error);
  };

  dataChannel.onmessage = (event) => {
    console.log("Got Data Channel Message:", event.data);
  };

  dataChannel.onopen = () => {
    dataChannel.send("Hello World!");
  };

  dataChannel.onclose = () => {
    console.log("The Data Channel is Closed");
  };
  console.log(dataChannel);
}

const createOffer = async () => {
  let getoffer = await rtcPeerConnection.createOffer();
  rtcPeerConnection.setLocalDescription(getoffer);
  socket.emit("offer", getoffer, roomName);
  console.log("offer created and sent");
};
const createAnswer = async () => {
  let getans = await rtcPeerConnection.createAnswer();
  rtcPeerConnection.setLocalDescription(getans);
  socket.emit("answer", getans, roomName);
  console.log("answer created and sent");
};
function OnIceCandidateFunction(event) {
  console.log("Candidate");
  if (event.candidate) {
    socket.emit("iceCandidates", event.candidate, roomName);
    console.log("ice candidate sent");
  }
}
function OnTrackFunction(event) {
  event.streams[0].getTracks().forEach((track) => {
    remotestream.addTrack(track);
  });
  peerVideo.onloadedmetadata = function (e) {
    peerVideo.play();
  };
}

/* ----------------------------Button event handlers----------------------------*/

function leavertc(event) {
  socket.emit("leave", roomName); //Let's the server know that user has left the room.

  if (userVideo.srcObject) {
    userVideo.srcObject.getTracks()[0].stop(); //Stops receiving audio track of User.
    userVideo.srcObject.getTracks()[1].stop(); //Stops receiving the Video track of User
  }
  if (peerVideo.srcObject) {
    peerVideo.srcObject.getTracks()[0].stop(); //Stops receiving audio track of Peer.
    peerVideo.srcObject.getTracks()[1].stop(); //Stops receiving the Video track of Peer.
  }

  //Checks if there is peer on the other side and safely closes the existing connection established with the peer.
  if (rtcPeerConnection) {
    rtcPeerConnection.ontrack = null;
    rtcPeerConnection.onicecandidate = null;
    rtcPeerConnection.close();
    rtcPeerConnection = null;
  }
  window.location = "/";
}

let toggleCamera = async () => {
  let videoTrack = userStream
    .getTracks()
    .find((track) => track.kind === "video");
  if (videoTrack.enabled) {
    videoTrack.enabled = false;
    document.querySelector("#cam-btn").style.backgroundColor = "rgb(255,80,80)";
  } else {
    videoTrack.enabled = true;
    document.querySelector("#cam-btn").style.backgroundColor = "#fff";
  }
};

let toggleMic = async () => {
  let audioTrack = userStream
    .getTracks()
    .find((track) => track.kind === "audio");
  if (audioTrack.enabled) {
    audioTrack.enabled = false;
    document.querySelector("#mic-btn").style.backgroundColor = "rgb(255,80,80)";
  } else {
    audioTrack.enabled = true;
    document.querySelector("#mic-btn").style.backgroundColor = "#fff";
  }
};

function start() {
  roomName = urlParams.get("room");
  if (!roomName || !username) {
    window.location = "/";
  } else {
    socket.emit("joinRoom", roomName);
  }
}

/* ----------------------------Socket functions and handlers----------------------------*/
socket.on("sendDetails", (data) => {
  console.log(data);
  peername = data;
  document.querySelector("#peername").innerHTML = peername;
});
socket.on("createdRoom", () => {
  creator = true;
  getvideo();
});

socket.on("full", function () {
  alert("Room is Full, Can't Join");
});

const afterjoiningRoom = async () => {
  await getvideo();
  socket.emit("ready", roomName);
};
socket.on("roomJoined", () => {
  creator = false;
  afterjoiningRoom();
});

socket.on("ready", () => {
  if (creator) {
    createConnection();
    createDatachannel();
    createOffer();
  }
});

socket.on("candidate", function (candidate) {
  let icecandidate = new RTCIceCandidate(candidate);
  rtcPeerConnection.addIceCandidate(icecandidate);
  console.log("ice candidates added");
  document.querySelector("#user-container1").style.display = "block";
});

socket.on("answer", function (answer) {
  rtcPeerConnection.setRemoteDescription(answer);
});

socket.on("offer", (offer) => {
  if (!creator) {
    createConnection();
    rtcPeerConnection.setRemoteDescription(offer);
    rtcPeerConnection.ondatachannel = ({ channel }) => {
      console.log("peerConnection::ondatachannel");
      rtcPeerConnection.dataChannel = channel;
      rtcPeerConnection.dataChannel.onopen = () => console.log("opened");
      rtcPeerConnection.dataChannel.onmessage = (e) => console.log(e.data);
    };
    createAnswer();
  }
});

socket.on("leave", function () {
  console.log("got event");
  creator = true;

  document.querySelector("#user-container1").style.display = "none";
  if (peerVideo.srcObject) {
    peerVideo.srcObject.getTracks()[0].stop();
    peerVideo.srcObject.getTracks()[1].stop();
  }

  if (rtcPeerConnection) {
    rtcPeerConnection.ontrack = null;
    rtcPeerConnection.onicecandidate = null;
    rtcPeerConnection.close();
    rtcPeerConnection = null;
  }
});

/* ----------------------------Event handler declarations----------------------------*/

document.querySelector("#mic-btn").addEventListener("click", toggleMic);
document.querySelector("#cam-btn").addEventListener("click", toggleCamera);
document.querySelector("#leave-btn").addEventListener("click", leavertc);
document.querySelector("#username").innerHTML = username;
document.querySelector("#room-name").innerHTML = urlParams.get("room");
window.addEventListener("beforeunload", leavertc);

start();
