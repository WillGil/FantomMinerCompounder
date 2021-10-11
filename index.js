require('dotenv').config()
const Web3Feature = require('web3')

// Grab env variables
const rpcUrl = process.env.RPC_URL
const privateKey = process.env.PRIVATE_KEY


// Import web3 wiith the FTM RPC 
const web3 = new Web3Feature(rpcUrl)
const wallet = web3.eth.accounts.wallet.add(privateKey)

// Smart contract address
const FTM_MINER_CONTRACT = "0x69e7D335E8Da617E692d7379e03FEf74ef295899"


// Contract ABI
const FTM_MINER_ABI = [{"constant":true,"inputs":[],"name":"ceoAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getMyMiners","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getBalance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"initialized","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"rt","type":"uint256"},{"name":"rs","type":"uint256"},{"name":"bs","type":"uint256"}],"name":"calculateTrade","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"eth","type":"uint256"},{"name":"contractBalance","type":"uint256"}],"name":"calculateEggBuy","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"marketEggs","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"sellEggs","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"amount","type":"uint256"}],"name":"devFee","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[],"name":"seedMarket","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"ref","type":"address"}],"name":"hatchEggs","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getMyEggs","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"lastHatch","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"claimedEggs","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"hatcheryMiners","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"EGGS_TO_HATCH_1MINERS","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"eth","type":"uint256"}],"name":"calculateEggBuySimple","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"eggs","type":"uint256"}],"name":"calculateEggSell","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"referrals","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"ceoAddress2","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"adr","type":"address"}],"name":"getEggsSinceLastHatch","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"ref","type":"address"}],"name":"buyEggs","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"}]


// Create new object
const fantomMinerContract = new web3.eth.Contract(FTM_MINER_ABI, FTM_MINER_CONTRACT)


let isCompoundingCurrently = false

// Value to store current miners
let minersBefore

// Create function that can be used to check for compounding oppertunities
const checkOpportunityToCompound = async function(){

    // If the script is currently compounding then do nothing
    if(isCompoundingCurrently) return;

    try{

    // Pause execution until the promise is settled 
    const obtainedRewards = await fantomMinerContract.methods.getEggsSinceLastHatch(wallet.address).call()
    const referralRewards = await fantomMinerContract.methods.claimedEggs(wallet.address).call()


    // Add referral FTM and base FTM mined
    const combinedTotalEggs = parseInt(obtainedRewards)+parseInt(referralRewards)

    // Calculate the FTM value
    const salePrice = await fantomMinerContract.methods.calculateEggSell(combinedTotalEggs.toString()).call()

    // Minus the developer fee as it's taken out automatically
    const devFee = await fantomMinerContract.methods.devFee(salePrice).call() 


    // Calculate the final amount of FTM that is mine
    const finalAmount = parseInt(salePrice) - parseInt(devFee)

    // Caluate FTM rewards
    const rewards =  web3.utils.fromWei(finalAmount.toString())

    // Round to 4 dp
    const ftmValue = parseFloat(parseFloat(rewards).toFixed(4))

    //console.log(`You have ${ftmValue} FTM Available to harvest`);

    // Organise the gas limit and check if we are ready to compound
    const gasLimit = 100000
    const gasPrice = await web3.eth.getGasPrice()
    const txCost = web3.utils.fromWei(gasPrice.toString()) * gasLimit
    //console.log(`The maximum gas price is ${txCost}`)
    
    // We use this to determine what multiple of the tx cost we wanna compound at 
    const multiplierTxCost = 3
    const threshold = multiplierTxCost * txCost
    // We can compound now 
    if(ftmValue > threshold){

        // Get the current amount of miners 
        minersBefore = await fantomMinerContract.methods.hatcheryMiners(wallet.address).call()

        console.log(`Ready to compound ${ftmValue} FTM`);
        isCompoundingCurrently = true
        compound(gasLimit, gasPrice)
    } else{
        console.log(`Not ready to compound ${ftmValue} as it's not more than ${threshold}`)
    }

   } catch(error){
       console.log(`Failed to call smart contract, try again! ${error.stack}`);
   }

}

const compound = async function(gasLimit, gasPrice){
    // We want to compound if we get to this point so hit the hatch eggs endpoint.
    try{
        console.log('Invoking hatchEggs');

        const hatchEggsTx = await fantomMinerContract.methods.hatchEggs(wallet.address).send(
        {
            from:wallet.address,
            gas:gasLimit,
            gasPrice:gasPrice,

        })
        console.log(`Compound status: ${hatchEggsTx.status}`)
    }catch(error){
        console.log(`Failed to compound with smart contract, try again! ${error.stack}`);
        isCompoundingCurrently = false
        return
    }

    //Get miners after
    const minersAfter = await fantomMinerContract.methods.hatcheryMiners(wallet.address).call()

    // Now we check for how many miners we have gained
    const minersIncrease = minersAfter - minersBefore

    isCompoundingCurrently = false
    console.log(`Finished Compounding, you have gained ${minersIncrease} miners`)
}

checkOpportunityToCompound()
const POLLING_INTERVAL = 240000 // 4 minutes 
// Ping the endpoint when possible
setInterval(async () => { await checkOpportunityToCompound() },POLLING_INTERVAL)



