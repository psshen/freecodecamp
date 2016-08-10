$(function () {
  'use strict'

  var ACTION = {
    DIGIT: 0,
    PERIOD: 1,
    BINARY_OP: 2,
    EQUALS: 3
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
   * transitions to other states.
   * @param initState
   * @constructor
   */
  function FSM (initState) {
    var currState = initState

    return {
      transition: function (action) {
        this.setState(currState(action))
      },

      setState: function (newState) {
        currState = newState
      }
    }
  }

  function Screen () {
    const MAX_DIGITS = 10
    var $significand = $('.significand')
    var $integer = $('.integer')
    var $fraction = $('.fraction')
    var $exponent = $('.exponent')

    function isBlank () {
      return $significand.text() === '0' && $('.screen.integer').hasClass('decimal')
    }

    function isDecimal () {
      return $integer.hasClass('decimal')
    }

    function numDigits () {
      return $significand.text().replace('-', '').length
    }

    function clear () {
      $fraction.text('')
      $exponent.text('')
      $integer.fadeOut(0, function () {
        $(this).text('0')
          .toggleClass('decimal', true)
          .delay(100)
          .fadeIn(0)
      })
    }

    function reverseSign () {
      if (isBlank()) return

      var currInt = $integer.text()
      var newNum = currInt.startsWith('-')
        ? currInt.substr(1)
        : '-' + currInt
      $integer.text(newNum)
    }

    function getNumber () {
      return parseFloat($integer.text() + (isDecimal() ? '.' : '') + $fraction.text())
    }

    function printNumber (number) {
      if (number % 1 === 0) {
        $integer.text(number)
        $integer.toggleClass('decimal', false)
      }
      else {
        $integer.text(number / 1)
        appendPeriod()
        $fraction.text(number % 1)
      }
    }

    function appendPeriod () {
      $integer.toggleClass('decimal', true)
    }

    function appendChar (char) {
      if (numDigits() === MAX_DIGITS) return

      var part = isDecimal() ? $fraction : $integer
      part.text(part.text() + char)
    }

    return {
      getNumber: getNumber,
      clear: clear,
      reverseSign: reverseSign,
      printNumber: printNumber,
      appendPeriod: appendPeriod,
      appendChar: appendChar
    }
  }

  /**
   * Singleton controller for updating calculator view
   */
  var Calculator = (function () {
    var fsm = new FSM(startState)
    var screen = new Screen()

    function startState (action) {
      switch (action.type) {
        case ACTION.DIGIT:
          screen.printNumber(action.val)
          return integerState
        case ACTION.PERIOD:
          screen.printNumber(0)
          screen.appendPeriod()
          return floatState
        case ACTION.BINARY_OP:
          return makeChainState(screen.getNumber(), action.val)
        default:
          return startState
      }
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
          screen.appendPeriod()
          return floatState
        case ACTION.BINARY_OP:
          screen.appendPeriod()
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
      function wrapWithChainingTransitions (wrappedStateFn) {
        return function (action) {
          switch (action.type) {
            // Calculate and continue chain
            case ACTION.BINARY_OP:
              screen.printNumber(calculate(currNum, op))
              screen.appendPeriod()
              return makeChainState(screen.getNumber(), action.val)
            // Calculate and exit chain
            case ACTION.EQUALS:
              screen.printNumber(calculate(currNum, op))
              screen.appendPeriod()
              return startState
            // Otherwise, delegate to wrapped fn
            default:
              return wrappedStateFn(action)
          }
        }
      }

      return function chainState (action) {
        switch (action.type) {
          case ACTION.DIGIT:
            screen.printNumber(action.val)
            return wrapWithChainingTransitions(integerState)
          case ACTION.PERIOD:
            screen.printNumber(0)
            screen.appendPeriod()
            return wrapWithChainingTransitions(floatState)
          // Stay in chain state, update operation type
          case ACTION.BINARY_OP:
            screen.appendPeriod()
            return makeChainState(currNum, action.val)
          default:
            return chainState
        }
      }
    }


    function calculate (lhs, op) {
      var rhs = screen.getNumber()

      switch (op) {
        case OP.PERCENTAGE:
          return lhs / 100. * rhs
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
        screen.clear()
        fsm.setState(startState)
      },
      reverseSign: function () {
        screen.reverseSign()
      },
      update: function (action) {
        fsm.transition(action)
      }
    }
  })()

  $('.clear').on('click', Calculator.clear)

  $('.sign').on('click', Calculator.reverseSign)

  $('.digit').on('click', function () {
    Calculator.update({ type: ACTION.DIGIT, val: $(this).text() })
  })

  $('.period').on('click', function () {
    Calculator.update({ type: ACTION.PERIOD })
  })

  $('.binary_op').on('click', function () {
    Calculator.update({ type: ACTION.BINARY_OP, val: OP[ $(this).attr('data-optype') ] })
  })

  $('.equals').on('click', function () {
    Calculator.update({ type: ACTION.EQUALS })
  })
});