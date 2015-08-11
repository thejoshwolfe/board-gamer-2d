var canvas = document.getElementById("canvas");
var cards = [
  {x:100, y:100},
];
var mousedCard;
var xstart;
var ystart;

var suImage = new Image();
suImage.src = "su.png";
suImage.addEventListener("load", function() {
  render();
});
function createCard(x,y){
  cards.push({x:x, y:y});
}
canvas.addEventListener("mousedown", function(event){
  var x = eventToMouseX(event,canvas);
  var y = eventToMouseY(event,canvas);
  if(event.button === 0){
    for(var i = cards.length-1; i>=0;i--){
      var card = cards[i];
      if (x > card.x && x<card.x + deckProperties.width &&
          y > card.y && y<card.y + deckProperties.height) {
        mousedCard = card;
        xstart = x;
        ystart = y;
        cards.splice(i,1);
        cards.push(card);
        break;
      }
    }
  }
  if(event.button === 2){
    createCard(x,y);
  }
  event.preventDefault();
  render();
});
canvas.addEventListener("contextmenu", function(event){
 event.preventDefault();
});
document.addEventListener("mouseup", function(event){
  mousedCard = null;
});
canvas.addEventListener("mousemove", function(event){
  if(mousedCard != null){
    var x = eventToMouseX(event,canvas);
    var y = eventToMouseY(event,canvas);
    var dx = (x - xstart);
    var dy = (y - ystart);
    xstart = x;
    ystart = y;
    mousedCard.x += dx;
    mousedCard.y += dy;
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
    for(var i = 0; i<cards.length;i++){
      context.drawImage(suImage,
          cardProperties.cropX, cardProperties.cropY,
          cardProperties.cropW, cardProperties.cropH,
          cards[i].x, cards[i].y,
          deckProperties.width, deckProperties.height
      );
    }
  }
}

render();
