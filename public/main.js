'use strict'

const socket = io()

const board = document.querySelector('.board')
const status = document.querySelector('.status')

const boardState = [
  ['','',''],
  ['','',''],
  ['','',''],
]

let nextPlayer = 'X'

const renderStatus = game => {
  status.innerText = game.result
    ? `${game.result} WON!`
    : `${game.toMove}'s Turn`
}

const renderBoard = game => {
  const b = game.board

  board.innerHTML = `
    <table>
      <tr>
        <td>${b[0][0]}</td>
        <td>${b[0][1]}</td>
        <td>${b[0][2]}</td>
      </tr>
      <tr>
        <td>${b[1][0]}</td>
        <td>${b[1][1]}</td>
        <td>${b[1][2]}</td>
      </tr>
      <tr>
        <td>${b[2][0]}</td>
        <td>${b[2][1]}</td>
        <td>${b[2][2]}</td>
      </tr>
    </table>
  `
}

board.addEventListener('click', evt => {
  const col = evt.target.cellIndex
  const row = evt.target.closest('tr').rowIndex

  if (boardState[row][col]) {
    return console.log('Cannot move there')
  }

  socket.emit('make move', { row, col })

  boardState[row][col] = nextPlayer
  console.log('Current game state:', board)

  nextPlayer = nextPlayer === 'X' ? 'O' : 'X'
})

const render = game => {
  renderStatus(game)
  renderBoard(game)
}

socket.on('connect', () => console.log(`Socket connected: ${socket.id}`))
socket.on('disconnect', () => console.log('Socket disconnected'))
socket.on('error', console.error)
socket.on('new game', render)
socket.on('move made', render)
