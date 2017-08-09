/* eslint-env jquery */
var CalculatorApp = (function () {
  'use strict'
  const MAX_DIGITS = 10 // Width of screen in digits

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
  function Screen (initNumber) {
    // Split up number into components since floats and scientific numbers aren't monospace
    var $number = $('.number')
    var $integer = $('.integer')
    var $fraction = $('.fraction')
    var $exponent = $('.exponent')
    var number = initNumber

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

    function printNumber () {
      changeToDecimal(number.isDecimal())
      var {integer, fraction, exponent, isNegative} = number.toPrintable()

      $integer.text((isNegative ? '-' : '') + integer)
      $fraction.text(fraction)
      $exponent.text(exponent)

      blink()
    }

    function loadNumber (newNumber) {
      number = newNumber
    }

    function changeToDecimal (bool) {
      $integer.toggleClass('decimal', bool)
    }

    return {
      zeroOut: zeroOut,
      loadNumber: loadNumber,
      printNumber: printNumber
    }
  }

  function CalcNumber (initNum, initIsDecimal) {
    var num = initNum
    var str = initNum.toString()
    var isDecimalNum = false
    setDecimal(initIsDecimal)
    var isNegative = false

    function numDigits () {
      return str.replace('.', '').length
    }

    function appendChar (ch) {
      if (numDigits() === MAX_DIGITS) {
        return false
      }

      str += ch
      num = parseFloat(str)

      return true
    }

    function reverseSign () {
      isNegative = !isNegative
      str = '-' + str
      num = -num
    }

    function setDecimal (newIsDecimal) {
      str += '.'
      isDecimalNum = newIsDecimal
    }

    function isDecimal () {
      return isDecimalNum
    }

    function toNumber () {
      return num
    }

    function toPrintable () {
      var newInteger = ''
      var newFraction = ''
      var newExponent = ''

      var exponentialStr = num.toExponential()
      var exponentIndex = exponentialStr.indexOf('e')
      var integer = exponentialStr.substring(0, 1)
      var fraction = exponentialStr.substring(2, exponentIndex)
      var exponent = exponentialStr.substring(exponentIndex + 2)

      let exponentNum = parseInt(exponent)
      // Number can't fit on screen
      if (exponentNum >= MAX_DIGITS || exponentNum <= -(MAX_DIGITS - 1)) {
        newInteger = integer
        // TODO pass isDecimal in return value?
        // setDecimal(true)
        newFraction = fraction.substring(0, MAX_DIGITS - 1)
        newExponent = exponent
      } else {
        var numberStr = num.toString()
        var decimalPointIndex = numberStr.indexOf('.')
        if (decimalPointIndex === -1) {
          newInteger = numberStr
          // setDecimal(false)
        } else {
          newInteger = numberStr.substring(0, decimalPointIndex)
          // setDecimal(true)
          newFraction = numberStr.substring(decimalPointIndex + 1, Math.min(MAX_DIGITS + 1, numberStr.length))
          // Round first digit past the end of the screen
          var digitAfterLast = numberStr.charAt(MAX_DIGITS + 1)
          if (digitAfterLast && digitAfterLast > 5) {
            newFraction = newFraction.slice(0, -1) + (parseInt(newFraction.charAt(newFraction.length - 1)) + 1)
          }
        }
      }
      return {
        integer: newInteger,
        fraction: newFraction,
        exponent: newExponent,
        isNegative: isNegative
      }
    }

    function calculate (other, op) {
      let lhs = toNumber()
      other = other.toNumber()
      let result = (function () {
        switch (op) {
          case OP.PERCENTAGE:
            return lhs / 100 * other
          case OP.DIVIDE:
            return lhs / other
          case OP.MULTIPLY:
            return lhs * other
          case OP.SUBTRACT:
            return lhs - other
          case OP.ADD:
            return lhs + other
          default:
            return 0
        }
      })()
      return CalcNumber(result, true)
    }

    return {
      appendChar: appendChar,
      reverseSign: reverseSign,
      setDecimal: setDecimal,
      toNumber: toNumber,
      isDecimal: isDecimal,
      toPrintable: toPrintable,
      calculate: calculate
    }
  }

  /**
   * Controller for updating calculator view
   */
  function Calculator (screen) {
    var fsm = new FiniteStateMachine(startStateGen(CalcNumber(0, true)))

    function startStateGen (num) {
      return function startState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            num = CalcNumber(parseInt(action.val), false)
            screen.loadNumber(num)
            if (action.val === '0') {
              return zeroStateGen(num)
            } else {
              return integerStateGen(num)
            }
          case ACTION.PERIOD:
            num = CalcNumber(0, true)
            screen.loadNumber(num)
            return floatStateGen(num)
          case ACTION.BINARY_OP:
            screen.loadNumber(num)
            return chainStateGen(num, action.val)
          case ACTION.REVERSE_SIGN:
            if (num.toNumber() === 0) {
              return startState
            }
            num.reverseSign()
            screen.loadNumber(num)
            return startStateGen(num)
          default:
            return startState
        }
      }
    }

    // TODO add explicit transitions
    function zeroStateGen (num) {
      return function zeroState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            num = CalcNumber(parseInt(action.val), false)
            screen.loadNumber(num)
            if (action.val === '0') {
              return zeroState
            } else {
              return integerStateGen(num)
            }
          case ACTION.PERIOD:
            num = CalcNumber(0, true)
            screen.loadNumber(num)
            return floatStateGen(num)
          case ACTION.BINARY_OP:
            screen.loadNumber(num)
            return chainStateGen(num, action.val)
          case ACTION.REVERSE_SIGN:
            num.reverseSign()
            screen.loadNumber(num)
            return zeroStateGen(num)
          default:
            return zeroState
        }
      }
    }

    /**
     * Number displayed on screen is an integer
     */
    function integerStateGen (num) {
      return function integerState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            num.appendChar(action.val)
            screen.loadNumber(num)
            return integerStateGen(num)
          case ACTION.PERIOD:
            num.setDecimal(true)
            screen.loadNumber(num)
            return floatStateGen(num)
          case ACTION.BINARY_OP:
            num.setDecimal(true)
            screen.loadNumber(num)
            return chainStateGen(num, action.val)
          case ACTION.REVERSE_SIGN:
            num.reverseSign()
            screen.loadNumber(num)
            return integerStateGen(num)
          default:
            return integerState
        }
      }
    }

    /**
     * Number displayed on screen is floating point
     */
    function floatStateGen (num) {
      return function floatState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            num.appendChar(action.val)
            screen.loadNumber(num)
            return floatStateGen(num)
          case ACTION.BINARY_OP:
            screen.loadNumber(num)
            return chainStateGen(num, action.val)
          case ACTION.REVERSE_SIGN:
            num.reverseSign()
            screen.loadNumber(num)
            return floatStateGen(num)
          default:
            return floatState
        }
      }
    }

    /**
     * Generator for the Chain state transition fn, a modified Start state fn in which the first
     * number in a chain has been entered.
     * @param lhsNum - Number passed into the chain that will be used as LHS value on next operation
     * @param op - Operation type
     * @returns {function} Chain state transition function
     */
    function chainStateGen (lhsNum, op) {
      function calculateAndContinue (lhsNum, rhsNum, action, defaultFn) {
        // TODO check for overflow
        var result = lhsNum.calculate(rhsNum, op)
        screen.loadNumber(result)
        switch (action.type) {
          // Calculate and continue chain
          case ACTION.BINARY_OP:
            return chainStateGen(result, action.val)
          // Calculate and exit chain
          case ACTION.EQUALS:
            return startStateGen(result)
          default:
            return defaultFn
        }
      }

      /**
       * Number displayed on screen is an integer
       */
      function integerStateChainedGen (num) {
        return function integerStateChained (action) {
          switch (action.type) {
            case ACTION.DIGIT:
              num.appendChar(action.val)
              screen.loadNumber(num)
              return integerStateChainedGen(num)
            case ACTION.PERIOD:
              num.setDecimal(true)
              screen.loadNumber(num)
              return floatStateChainedGen(num)
            case ACTION.REVERSE_SIGN:
              num.reverseSign()
              screen.loadNumber(num)
              return integerStateChainedGen(num)
            default:
              return calculateAndContinue(lhsNum, num, action, integerStateChained)
          }
        }
      }

      /**
       * Number displayed on screen is floating point
       */
      function floatStateChainedGen (num) {
        return function floatStateChained (action) {
          switch (action.type) {
            case ACTION.DIGIT:
              num.appendChar(action.val)
              screen.loadNumber(num)
              return floatStateChainedGen(num)
            case ACTION.REVERSE_SIGN:
              num.reverseSign()
              screen.loadNumber(num)
              return floatStateChainedGen(num)
            default:
              return calculateAndContinue(lhsNum, num, action, floatStateChained)
          }
        }
      }

      function zeroStateChainedGen (num) {
        return function zeroStateChained (action) {
          if (action.DIGIT && action.val === '0') {
            return zeroStateChained
          } else if (action.type === ACTION.REVERSE_SIGN) {
            num.reverseSign()
            screen.loadNumber(num)
            return zeroStateChainedGen(num)
          }
          return chainState
        }
      }

      function chainState (action) {
        var num
        switch (action.type) {
          case ACTION.DIGIT:
            num = CalcNumber(parseInt(action.val), false)
            screen.loadNumber(num)
            if (action.val === '0') {
              return zeroStateChainedGen(num)
            } else {
              return integerStateChainedGen(num)
            }
          case ACTION.PERIOD:
            num = CalcNumber(0, true)
            screen.loadNumber(num)
            return floatStateChainedGen(num)
          // Stay in chain state, update operation type
          case ACTION.BINARY_OP:
            screen.loadNumber(lhsNum)
            return chainStateGen(lhsNum, action.val)
          case ACTION.EQUALS:
            screen.loadNumber(lhsNum)
            return startStateGen(lhsNum)
          case ACTION.REVERSE_SIGN:
            lhsNum.reverseSign()
            screen.loadNumber(lhsNum)
            return chainStateGen(lhsNum, op)
          default:
            return chainState
        }
      }

      return chainState
    }

    return {
      clear: function () {
        fsm.setState(startStateGen(CalcNumber(0, true)))
        screen.zeroOut()
      },
      update: function (action) {
        fsm.transition(action)
        screen.printNumber()
      }
    }
  }

  function bindFunctions (calc) {
    $('.clear').on('click', calc.clear)

    $('.sign').on('click', calc.update({type: ACTION.REVERSE_SIGN}))

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
        // case 'NumLock':
        //   calc.update(ACTION.REVERSE_SIGN)
        //   break
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
    var screen = new Screen(CalcNumber(0, true))
    var calc = new Calculator(screen)
    bindFunctions(calc)
  }

  return {
    onReady: onReady
  }
})()

$(document).ready(CalculatorApp.onReady)
