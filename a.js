var canvas = document.getElementById("canvas");

var suImage = new Image();
suImage.src = "su.png";
suImage.addEventListener("load", function() {
  render();
});

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
        100, 100,
        deckProperties.width, deckProperties.height
    );
  }
}

render();
