/* eslint-env jquery */
var CalculatorApp = (function () {
  'use strict'

  var ACTION = {
    DIGIT: 0,
    PERIOD: 1,
    BINARY_OP: 2,
    EQUALS: 3,
    REVERSE_SIGN: 4
  }

  var OP = {
    PERCENTAGE: 0,
    DIVIDE: 1,
    MULTIPLY: 2,
    SUBTRACT: 3,
    ADD: 4
  }

  /**
   * Finite state machine that maintains a single state transition fn at a time that handles
   * transitions to the next state given some action.
   * @param initStateFn
   * @constructor
   */
  function FiniteStateMachine (initStateFn) {
    var currStateFn = initStateFn

    return {
      transition: function (action) {
        console.log('Transition from state: ' + currStateFn.name)
        this.setState(currStateFn(action))
      },

      setState: function (newStateFn) {
        currStateFn = newStateFn
      }
    }
  }

  /**
   * Displays, updates, and parses current number.
   */
  function Screen () {
    const MAX_DIGITS = 10 // Width of screen in digits
    // Split up number into components since floats and scientific numbers aren't monospace
    var $number = $('.number')
    var $significand = $('.significand') // Group of all digits before and after decimal point
    var $integer = $('.integer')
    var $fraction = $('.fraction')
    var $exponent = $('.exponent')

    function isBlank () {
      return $significand.text().trim() === '0' && isDecimal()
    }

    function isDecimal () {
      return $integer.hasClass('decimal')
    }

    function numDigits () {
      return $significand.text().trim().replace('-', '').length
    }

    function zeroOut () {
      $fraction.text('')
      $exponent.text('')
      $integer.fadeOut(0, function () {
        $(this).text('0')
          .toggleClass('decimal', true)
          .delay(100)
          .fadeIn(0)
      })
    }

    function blink () {
      $number.fadeOut(0).delay(10).fadeIn(0)
    }

    function reverseSign () {
      if (isBlank()) return

      var currInt = $integer.text()
      var newNum = currInt.startsWith('-')
        ? currInt.substr(1)
        : '-' + currInt
      $integer.text(newNum)
    }

    function isScientific () {
      return !$exponent
    }

    function getNumber () {
      var numStr = $integer.text().trim()
      if (isDecimal()) {
        numStr += '.' + $fraction.text().trim()
      }
      if (isScientific()) {
        numStr += 'e+' + $exponent.text().trim()
      }

      var number = parseFloat(numStr)
      // console.log('Parsed: ' + number)
      return number
    }

    function printNumber (number) {
      var newInteger = ''
      var newFraction = ''
      var newExponent = ''

      var exponentialStr = number.toExponential()
      var exponentIndex = exponentialStr.indexOf('e')
      var integer = exponentialStr.substring(0, 1)
      var fraction = exponentialStr.substring(2, exponentIndex)
      var exponent = exponentialStr.substring(exponentIndex + 2)

      if (exponent > MAX_DIGITS - 1) {
        newInteger = integer
        changeToDecimal(true)
        newFraction = fraction.substring(0, MAX_DIGITS - 1)
        newExponent = exponent
      } else {
        var numberStr = number.toString()
        var decimalPointPosition = numberStr.indexOf('.')
        if (decimalPointPosition === -1) {
          newInteger = numberStr
          changeToDecimal(false)
        } else {
          newInteger = numberStr.substring(0, decimalPointPosition)
          changeToDecimal(true)
          newFraction = numberStr.substring(decimalPointPosition + 1, Math.min(MAX_DIGITS + 1, numberStr.length))
          // Round first digit past the end of the screen
          var digitAfterLast = numberStr.charAt(MAX_DIGITS + 1)
          if (digitAfterLast && digitAfterLast > 5) {
            newFraction = newFraction.slice(0, -1) + (parseInt(newFraction.charAt(newFraction.length - 1)) + 1)
          }
        }
      }

      $integer.text(newInteger)
      $fraction.text(newFraction)
      $exponent.text(newExponent)
    }

    function changeToDecimal (bool) {
      $integer.toggleClass('decimal', bool)
    }

    function addDecimalPoint () {
      changeToDecimal(true)
    }

    function appendChar (char) {
      if (numDigits() === MAX_DIGITS) return

      var lastPart = isDecimal() ? $fraction : $integer
      lastPart.text(lastPart.text() + char)
    }

    return {
      getNumber: getNumber,
      zeroOut: zeroOut,
      blink: blink,
      reverseSign: reverseSign,
      printNumber: printNumber,
      changeToDecimal: changeToDecimal,
      addDecimalPoint: addDecimalPoint,
      appendChar: appendChar
    }
  }

  /**
   * Controller for updating calculator view
   */
  function Calculator (screen) {
    var fsm = new FiniteStateMachine(startState)

    function startState (action) {
      switch (action.type) {
        case ACTION.DIGIT:
          if (action.val === '0') {
            screen.printNumber(0)
            screen.changeToDecimal(false)
            return zeroState
          }
          screen.printNumber(parseFloat(action.val))
          screen.changeToDecimal(false)
          return integerState
        case ACTION.PERIOD:
          screen.printNumber(0)
          screen.addDecimalPoint()
          return floatState
        case ACTION.BINARY_OP:
          return makeChainState(screen.getNumber(), action.val)
        default:
          return startState
      }
    }

    function zeroState (action) {
      if (action.DIGIT && action.val === '0') {
        return zeroState
      }
      return startState(action)
    }

    /**
     * Number displayed on screen is an integer
     */
    function integerState (action) {
      switch (action.type) {
        case ACTION.DIGIT:
          screen.appendChar(action.val)
          return integerState
        case ACTION.PERIOD:
          screen.addDecimalPoint()
          return floatState
        case ACTION.BINARY_OP:
          screen.addDecimalPoint()
          return makeChainState(screen.getNumber(), action.val)
        default:
          return integerState
      }
    }

    /**
     * Number displayed on screen is floating point
     */
    function floatState (action) {
      switch (action.type) {
        case ACTION.DIGIT:
          screen.appendChar(action.val)
          return floatState
        case ACTION.BINARY_OP:
          return makeChainState(screen.getNumber(), action.val)
        default:
          return floatState
      }
    }

    /**
     * Generator for the Chain state transition fn, a modified Start state fn in which the first
     * number in a chain has been entered.
     * @param currNum - Current number that will be chained next
     * @param op - Operation type
     * @returns {function} Chain state transition function
     */
    function makeChainState (currNum, op) {
      function addChainStateTransitionsTo (wrappedStateFn) {
        return function modifiedStateWithChaining (action) {
          switch (action.type) {
            // Calculate and continue chain
            case ACTION.BINARY_OP:
              // TODO check for overflow
              screen.printNumber(calculate(currNum, op))
              screen.addDecimalPoint()
              return makeChainState(screen.getNumber(), action.val)
            // Calculate and exit chain
            case ACTION.EQUALS:
              // TODO check for overflow
              screen.printNumber(calculate(currNum, op))
              screen.addDecimalPoint()
              return startState
            // Otherwise, delegate to wrapped state fn
            default:
              return addChainStateTransitionsTo(wrappedStateFn(action))
          }
        }
      }

      return function chainState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            if (action.val === '0') {
              screen.printNumber(0)
              screen.changeToDecimal(false)
              return addChainStateTransitionsTo(zeroState)
            }
            screen.printNumber(parseFloat(action.val))
            screen.changeToDecimal(false)
            return addChainStateTransitionsTo(integerState)
          case ACTION.PERIOD:
            screen.printNumber(0)
            screen.addDecimalPoint()
            return addChainStateTransitionsTo(floatState)
          // Stay in chain state, update operation type
          case ACTION.BINARY_OP:
            screen.addDecimalPoint()
            return makeChainState(currNum, action.val)
          case ACTION.EQUALS:
            return startState
          default:
            return chainState
        }
      }
    }

    function calculate (lhs, op) {
      var rhs = screen.getNumber()

      switch (op) {
        case OP.PERCENTAGE:
          return lhs / 100 * rhs
        case OP.DIVIDE:
          return lhs / rhs
        case OP.MULTIPLY:
          return lhs * rhs
        case OP.SUBTRACT:
          return lhs - rhs
        case OP.ADD:
          return lhs + rhs
        default:
          return 0
      }
    }

    return {
      clear: function () {
        screen.zeroOut()
        fsm.setState(startState)
      },
      reverseSign: function () {
        screen.reverseSign()
        screen.blink()
      },
      update: function (action) {
        fsm.transition(action)
        screen.blink()
      }
    }
  }

  function bindFunctions (calc) {
    $('.clear').on('click', calc.clear)

    $('.sign').on('click', calc.update(ACTION.REVERSE_SIGN))

    $('.digit').on('click', function () {
      calc.update({type: ACTION.DIGIT, val: $(this).text()})
    })

    $('.period').on('click', function () {
      calc.update({type: ACTION.PERIOD})
    })

    $('.binary_op').on('click', function () {
      calc.update({type: ACTION.BINARY_OP, val: OP[$(this).attr('data-optype')]})
    })

    $('.equals').on('click', function () {
      calc.update({type: ACTION.EQUALS})
    })

    window.addEventListener('keypress', function (event) {
      if (event.defaultPrevented) {
        return
      }
      console.log('Pressed key: ' + event.key)
      switch (event.key) {
        case 'Delete':
        case 'c':
          calc.clear()
          break
        case 'NumLock':
          calc.update(ACTION.REVERSE_SIGN)
          break
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          calc.update({type: ACTION.DIGIT, val: event.key})
          break
        case '.':
          calc.update({type: ACTION.PERIOD})
          break
        case '%':
          calc.update({type: ACTION.BINARY_OP, val: OP.PERCENTAGE})
          break
        case '/':
          calc.update({type: ACTION.BINARY_OP, val: OP.DIVIDE})
          break
        case '*':
          calc.update({type: ACTION.BINARY_OP, val: OP.MULTIPLY})
          break
        case '-':
          calc.update({type: ACTION.BINARY_OP, val: OP.SUBTRACT})
          break
        case '+':
          calc.update({type: ACTION.BINARY_OP, val: OP.ADD})
          break
        case 'Enter':
        case '=':
          calc.update({type: ACTION.EQUALS})
          break
      }
    })
  }

  function onReady () {
    var screen = new Screen()
    var calc = new Calculator(screen)
    bindFunctions(calc)
  }

  return {
    onReady: onReady,
    Screen: Screen
  }
})()

$(document).ready(CalculatorApp.onReady)
