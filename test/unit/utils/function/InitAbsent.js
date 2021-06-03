// console.log("******** enter the init block   ********");

let resolved = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms)).then(() => {resolved = true});
}

async function init() {
  // console.log("******** enter initializeFunction hook ********");
  // console.log("******** Is promised resolved? " + resolved + " ********");
  // console.log("******** sleep for 20 ms... ********")
  let p = await sleep(20);
  // console.log("******** wake up                ********");
  // console.log("******** Is promised resolved? " + resolved + " ********");
}

init();

exports.handler = async (event, context) => {
    // console.log("******** enter the handler        ********");
    // console.log("******** Is promised resolved? " + resolved + " ********");
    return ( resolved ? true: false );
}
