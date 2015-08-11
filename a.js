var canvas = document.getElementById("canvas");

var cardxloc = 100;
var cardyloc = 100;
var mdown = false;
var xstart;
var ystart;

var suImage = new Image();
suImage.src = "su.png";
suImage.addEventListener("load", function() {
  render();
});

canvas.addEventListener("mousedown", function(event){
  var x = eventToMouseX(event,canvas);
  var y = eventToMouseY(event,canvas);
  if (x > cardxloc && x<cardxloc + deckProperties.width &&
      y > cardyloc && y<cardyloc + deckProperties.height) {
    mdown = true;
    xstart = x;
    ystart = y;
  }
});
document.addEventListener("mouseup", function(event){
  mdown = false;
});
canvas.addEventListener("mousemove", function(event){
  if(mdown){
    var x = eventToMouseX(event,canvas);
    var y = eventToMouseY(event,canvas);
    var dx = (x - xstart);
    var dy = (y - ystart);
    xstart = x;
    ystart = y;
    cardxloc = cardxloc + dx;
    cardyloc = cardyloc + dy;
    render();
  }
});

function eventToMouseX(event, canvas) { return event.clientX - canvas.getBoundingClientRect().left; }
function eventToMouseY(event, canvas) { return event.clientY - canvas.getBoundingClientRect().top; }

var cardProperties = {
  cropX: 0,
  cropY: 0,
  cropW: 822,
  cropH: 1122,
};
var deckProperties = {
  height: 110,
  width: 81,
};

function render() {
  var context = canvas.getContext("2d");
  context.fillStyle = "#0a0";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (suImage.complete) {
    context.drawImage(suImage,
        cardProperties.cropX, cardProperties.cropY,
        cardProperties.cropW, cardProperties.cropH,
        cardxloc, cardyloc,
        deckProperties.width, deckProperties.height
    );
  }
}

render();
