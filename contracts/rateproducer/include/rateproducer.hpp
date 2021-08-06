/*
 * @file
 * @author  (C) 2020 by eoscostarica [ https://eoscostarica.io ]
 * @version 1.1.0
 *
 * @section DESCRIPTION
 *
 *    Smart contract rateproducer  
 *
 *    WebSite:        https://eosrate.io/
 *    GitHub:         https://github.com/eoscostarica/eos-rate
 *
 */
#include <eosio/eosio.hpp>
#include <eosio/print.hpp>
#include <eosio/asset.hpp>
#include <eosio/multi_index.hpp>
#include <eosio/system.hpp>
#include <eosio/time.hpp>
#include <eosio/permission.hpp> 
#include <algorithm>
#include <set>

#define MINVAL 0
#define MAXVAL 10
#define MIN_VOTERS 21 

using namespace std;
using namespace eosio;
using eosio::public_key; 

/*
*   this namespace is used to map producer_info and voter_info tables
*   within the local scope of this contract,  the follow functions :is_blockproducer,
*   get_voters, get_proxy, is_active_proxy relay on these tables.
*   this approaches came from this thread : 
*   https://eosio.stackexchange.com/questions/4676/check-within-smart-contract-if-an-account-is-a-proxy
*/  
namespace eosio {
    constexpr name system_account{"eosio"_n};

    /*
    * EOSIO producer_info table
    */
    struct producer_info {
        name                  owner;
        double                total_votes = 0;
        eosio::public_key     producer_key; /// a packed public key object
        bool                  is_active = true;
        std::string           url;
        uint32_t              unpaid_blocks = 0;
        time_point            last_claim_time;
        uint16_t              location = 0;

        uint64_t primary_key()const { return owner.value;                             }
        double   by_votes()const    { return is_active ? -total_votes : total_votes;  }
        bool     active()const      { return is_active;                               }
        void     deactivate()       { producer_key = public_key(); is_active = false; }

        // explicit serialization macro is not necessary, used here only to improve compilation time
        EOSLIB_SERIALIZE( producer_info, (owner)(total_votes)(producer_key)(is_active)(url)
                        (unpaid_blocks)(last_claim_time)(location) )
    };
    typedef eosio::multi_index< "producers"_n, producer_info,
                            indexed_by<"prototalvote"_n, const_mem_fun<producer_info, double, &producer_info::by_votes>>
                            > producers_table;

    /**
    *
    *  Verify is an account is a block producer
    *
    * @param bp_name - Contains the name of the account that we want to verify as bp
    *
    * @return true is the account is a block producer, otherwise returns false
    */                        
    bool is_blockproducer(name bp_name){
        producers_table bp(system_account, system_account.value);
        auto it = bp.find(bp_name.value);
        if(it==bp.end()){
            return false;
        }
        return it->is_active;
    }

    /*
    * EOSIO voter_info table
    */
    struct voter_info {
        name                owner;
        name                proxy;
        std::vector<name>   producers;
        int64_t             staked = 0;
        double              last_vote_weight = 0;
        double              proxied_vote_weight= 0;
        bool                is_proxy = 0;
        uint32_t            flags1 = 0;
        uint32_t            reserved2 = 0;
        eosio::asset        reserved3;

        uint64_t primary_key()const { return owner.value; }

        EOSLIB_SERIALIZE( voter_info, (owner)(proxy)(producers)(staked)(last_vote_weight)(proxied_vote_weight)(is_proxy)(flags1)(reserved2)(reserved3) )
    };
    typedef eosio::multi_index< "voters"_n, voter_info >  voters_table; 

    /**
    *
    *  returns the number of votes made
    *
    * @param name - Contains the name of the account that we wish to obtain the number of votes
    *
    * @return the amount of votes
    */  
    int get_voters (name name) {
        voters_table _voters(system_account, system_account.value);
        auto it = _voters.find(name.value);
        if(it==_voters.end()){
            return 0;
        }
        return it->producers.size();
    }

    /**
    *
    *  Returns the proxy name for an especific account
    *
    * @param name - Contains the name of the account that we want to obtain its proxy
    *
    * @return the proxy name, returns "" in case of non proxy
    */  
    eosio::name get_proxy ( eosio::name name) {
        voters_table _voters(system_account, system_account.value);
        auto it = _voters.find(name.value);
        if(it==_voters.end()){
            eosio::name result("");
            return result;
        }
        return it->proxy;
    }

    /**
    *
    *  Verify is an account is an active proxy
    *
    * @param name - Contains the name of the account that we want to verify as an active proxy
    *
    * @return true is the account is an antiVe proxy, otherwise returns false
    */  
    bool is_active_proxy(name name) {
        voters_table _voters(system_account, system_account.value);
        auto it = _voters.find(name.value);
        return it != _voters.end() && it->is_proxy;
    }

} // namespace eosio


CONTRACT rateproducer : public contract {
  public:
    using contract::contract;
    
        /**
        *
        *  Saves the info related with a sponsor within a community
        *
        * @param user - Voter account name,
        * @param bp -  Block Producer account name
        * @param transparency - Rate for transparency category
        * @param infrastructure - Rate for infrastructure category
        * @param trustiness - Rate for trustiness category
        * @param community - Rate for community category
        * @param development - Rate for development category
        *
        * @pre all rate category's vales must be an integer value
        * @pre all rate category's vales must be between 1 -10 
        *
        * @memo the account especific in user parameter is the ram payor
        * @memo user account must voted for at least 21 blockproducer 
        *       or vote for a proxy with at least 21 votes
        */  
        ACTION rate(
            name user, 
            name bp, 
            int8_t transparency,
            int8_t infrastructure,
            int8_t trustiness,
            int8_t community,
            int8_t development);

    /**
    *
    *  Stores the rate stats within stats table
    *  for a specific block producer
    *
    * @param user - Voter account name,
    * @param bp_name -  Block Producer account name
    * @param transparency - Rate for transparency category
    * @param infrastructure - Rate for infrastructure category
    * @param trustiness - Rate for trustiness category
    * @param community - Rate for community category
    * @param development - Rate for development category
    *
    * @memo this function is called for the first-time rate made 
    *       by the tuple {user,bp}
    *
    */      
    void save_bp_stats (
        name user,
        name bp_name,
        float transparency,
        float infrastructure,
        float trustiness,
        float community,
        float development);
    
    /**
    *
    *  Calculates the value for all categories 
    *  for a specified block producer, this fucntion
    *  iterates on ratings table 
    *
    * @param bp_name -  Block Producer account name
    * @param transparency - Calculated value for transparency category
    * @param infrastructure - Calculated value for infrastructure category
    * @param trustiness - Calculated value for trustiness category
    * @param community - Calculated value for community category
    * @param development - Calculated value for development category
    * @param ratings_cntr - Calculated value for rates counter
    * @param average -  Calculated average for categories 
    *
    * @memo zero values are ignored, see the unit test script test_averaje.js
    *       in order to learn more details about the average calculation
    * 
    * @memo  variables transparency, infrastructure, trustiness, community
    *        development, ratings_cntr, average are passed by reference
    *
    * @return calculated values for: transparency, infrastructure, trustiness, community
    *        development, ratings_cntr
    */ 
    void calculate_bp_stats (
        name bp_name,
        float * transparency,
        float * infrastructure,
        float * trustiness,
        float * community,
        float * development,
        uint32_t * ratings_cntr,
        float  * average);
    
    /**
    *
    *  Updates the stats table, with the new
    *  categories values for a specific block producer
    *  
    * @param user - Voter account name,
    * @param bp_name -  Block Producer account name
    * @param transparency - Rate for transparency category
    * @param infrastructure - Rate for infrastructure category
    * @param trustiness - Rate for trustiness category
    * @param community - Rate for community category
    * @param development - Rate for development category
    *
    */ 
    void update_bp_stats (
        name * user,
        name * bp_name,
        float * transparency,
        float * infrastructure,
        float * trustiness,
        float * community,
        float * development,
        uint32_t * ratings_cntr,
        float * average);
    
    /**
    *
    *  Erase all data related for a specific block producer
    *
    * @param bp_name -  Block Producer account name
    * 
    */ 
    ACTION erase(name bp_name);


    /**
    *
    *  Erase all data related for a set of block producer
    *
    * @param bps_to_clean -  List of Block Producer accounts 
    * 
    */ 
    void erase_bp_info(std::set<eosio::name> * bps_to_clean);


    /**
    *
    *  Clean all data store within the tables
    * 
    */ 
    ACTION wipe();
    
    /**
    *
    *  Erase all data for inactive block producers
    * 
    */ 
    ACTION rminactive();

    /**
    *
    *  Erase a rate made for a specific account 
    *  to a specific block producer
    *
    * @param user - Voter account name,
    * @param bp -  Block Producer account name
    * 
    */ 
    
    ACTION rmrate(name user, name bp);


  private:
    /*
    *   Stores the rate average stats for a block producer
    */    
    TABLE stats {
      name bp;
      uint32_t ratings_cntr;
      float average;
      float transparency;
      float infrastructure;
      float trustiness;
      float development;  
      float community;
      uint64_t primary_key() const { return bp.value; }
    };

    typedef eosio::multi_index<"stats"_n, stats > _stats;

    /*
    *   Stores the rate vote for a block producer
    */
    TABLE ratings {
      uint64_t id;
      uint128_t uniq_rating;
      name user;
      name bp;
      float transparency;
      float infrastructure;
      float trustiness;
      float development;  
      float community;
      uint64_t primary_key() const { return id; }
      uint128_t by_uniq_rating() const { return uniq_rating; }
      uint64_t by_user() const { return user.value; }
      uint64_t by_bp() const { return bp.value; }
    };

    typedef eosio::multi_index<"ratings"_n, ratings,
        indexed_by<"uniqrating"_n, const_mem_fun<ratings, uint128_t, &ratings::by_uniq_rating>>,
        indexed_by<"user"_n, const_mem_fun<ratings, uint64_t, &ratings::by_user>>,
        indexed_by<"bp"_n, const_mem_fun<ratings, uint64_t, &ratings::by_bp>>
      > _ratings;

};

EOSIO_DISPATCH(rateproducer,(rate)(erase)(wipe)(rminactive)(rmrate));